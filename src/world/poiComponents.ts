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
  // TORN-OPEN +X end. M11 ⓒⓓ (C63, user batch-1 walk-test): the ribs were 3 floating hoops
  // (sat in the wall gap, nothing tying them); the shell read knife-thin at the cut; the torn
  // flaps floated as cones centered at the ring radius. Now: ribs HUG the inner wall + are tied
  // by longitudinal STRINGERS (a rib cage); a thick cut-RIM annulus caps the outer↔liner wall
  // gap (the shell reads thick); flaps ANCHOR their base on the rim + peel outward over the lip.
  // C63c root-cause: makeFormerRings shrinks by 0.84 internally (radius*(0.84−i·taper)), so the
  // earlier `r*0.85` pass put the ribs at 0.71r — floating inside the liner (0.88r), and the
  // stringers (at 0.85r) floated above them. Pass ribActualR/0.84 so the largest ring lands AT
  // ribActualR (0.85r, just inside the liner), and place the stringers at that same radius.
  const ribActualR = r * 0.85;
  const ribStartX = len / 2 - len * 0.36, ribCount = 4, ribSpacing = len * 0.085;
  const formers = makeFormerRings(ribActualR / 0.84, ribCount, ribSpacing, { startX: ribStartX, arc: Math.PI * 1.3, taper: 0.03 });
  formers.position.y = r; formers.traverse((o) => { o.userData.isWreckDecoration = true; }); g.add(formers);
  // Longitudinal stringers tie the rib rings into a cage (at the ribs' actual radius).
  const ribSpan = ribSpacing * (ribCount - 1);
  for (const sa of [Math.PI * 0.18, Math.PI * 0.5, Math.PI * 0.82]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(ribSpan, 0.07, 0.07), _hullDarkMat);
    stringer.position.set(ribStartX + ribSpan / 2, r + Math.cos(sa) * ribActualR, Math.sin(sa) * ribActualR);
    stringer.userData.isWreckDecoration = true; g.add(stringer);
  }
  // Thick cut-RIM annulus at the torn lip — caps the wall gap (liner 0.88r → hull r) so the
  // shell reads as a thick wall cross-section, not a single knife-edge (the user's "very thin").
  const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 18), _hullDarkMat);
  rim.rotation.y = Math.PI / 2; rim.position.set(len / 2 - 0.04, r, 0);
  (rim.material as THREE.Material).side = THREE.DoubleSide; rim.userData.isWreckDecoration = true; g.add(rim);
  // Torn flaps — base ANCHORED on the rim, peeling outward + back over the lip (were floating cones).
  const _flapDir = new THREE.Vector3(), _flapQ = new THREE.Quaternion(), _flapUp = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 11; i++) {
    if (phash(seed, 12 + i) < 0.2) continue;   // skip → asymmetric jagged gaps
    const ang = (i / 11) * Math.PI * 2 + (phash(seed, 14 + i) - 0.5) * 0.5;
    const fh = r * (0.16 + phash(seed, 17 + i) * 0.22), fr = r * (0.10 + phash(seed, 16 + i) * 0.08);  // SHORT jagged torn-lip teeth (not long spikes)
    const flap = new THREE.Mesh(new THREE.ConeGeometry(fr, fh, 4), _rustMat);
    const ry = Math.cos(ang), rz = Math.sin(ang);
    const peel = 0.5 + phash(seed, 20 + i) * 0.5;               // peel back over the lip (−X) — flatter against the rim
    _flapDir.set(-peel, ry, rz).normalize();
    _flapQ.setFromUnitVectors(_flapUp, _flapDir);
    flap.quaternion.copy(_flapQ);                                // align cone axis to the peeled direction
    flap.position.set(                                           // BASE on the rim → center = rim + dir·(fh/2)
      len / 2 - 0.05 + _flapDir.x * fh * 0.5,
      r + ry * r + _flapDir.y * fh * 0.5,
      rz * r + _flapDir.z * fh * 0.5,
    );
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
    // Salvage hatch on the exposed UPPER surface (faces +Y → never occluded). M11 ⓔ (C62):
    // SUNK below the crest peak (2r) so the flat panel's edges embed into the curving hull
    // instead of overhanging it with a daylight gap (the "floating/unconnected" read). The
    // crest is the flattest spot (the tank is long in X), so a sunk panel here seats cleanly.
    { pos: new THREE.Vector3(-len * 0.36, r * 2 - 0.28, 0), quat: FACE.posY(), kind: 'cargo_container' as PanelKind },
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
  // M11 (C63d): φ values CLAMPED within the shell's covered arc (~0.43π..1.575π) so a seam
  // never lands past the open-top edge floating in the gap (1.62π did → the "floating plank").
  for (const phi of [Math.PI * 0.62, Math.PI * 0.92, Math.PI * 1.22, Math.PI * 1.48]) {
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
  // Exposed rib formers hugging the shell INNER wall. M11 ⓒ (C63c, root cause): makeFormerRings
  // applies a hidden 0.84× shrink (`radius*(0.84 − i·taper)`), so passing ~r put the ribs at
  // ~0.81r — floating ~19% INSIDE the shell (the "ribs not connected" read). Pass r*1.14 so the
  // largest ring lands at ~0.96r, touching the shell wall; later rings taper just inside it.
  const ribN = 3 + Math.floor(phash(seed, 3) * 3);
  const ribSpacingH = len / (ribN + 1), ribStartXH = -len / 2 + ribSpacingH;
  const formers = makeFormerRings(r * 1.14, ribN, ribSpacingH, {
    startX: ribStartXH, arc: Math.PI * 1.15, taper: 0.03,
  });
  formers.position.y = r;
  formers.traverse((o) => { o.userData.isWreckDecoration = true; });
  g.add(formers);
  // M11 ⓓ (C63c): the torn-rim CONE FLAPS + breach cone flaps are REMOVED — they persistently
  // read as floating spikes off the side (user feedback across rounds). The open-top edge + the
  // dark flank gash carry the "torn" read without detached cones.
  // A little settled wreckage on the floor (reads as a husk you could shelter in).
  for (let i = 0; i < 3; i++) {
    const cz = (phash(seed, 40 + i) - 0.5) * r * 0.9;
    const cx = (phash(seed, 50 + i) - 0.5) * len * 0.7;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.5 + phash(seed, 60 + i) * 0.6, 0.4, 0.5), _hullDarkMat);
    chunk.position.set(cx, 0.2, cz); chunk.rotation.y = phash(seed, 70 + i) * Math.PI;
    chunk.userData.isWreckDecoration = true; g.add(chunk);
  }
  // A torn flank breach on -Z (a dark recessed gash — a 2nd way to see in; no cone flaps).
  const bx = (phash(seed, 80) - 0.5) * len * 0.4;
  const gash = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, r * 0.7, 0.14), _hullDarkMat);
  gash.position.set(bx, r * 0.75, -r * 0.92); gash.userData.isWreckDecoration = true; g.add(gash);
  // Collider: the two curved SIDE walls (ends + top open → walk in; enterable-ready). The
  // player stands on the terrain inside; the side boxes stop lateral walk-through.
  const colliders: ColliderSpec[] = [
    { kind: 'box', half: { x: len / 2, y: r * 0.85, z: 0.3 }, pos: { x: 0, y: r * 0.7, z: r * 0.82 } },
    { kind: 'box', half: { x: len / 2, y: r * 0.85, z: 0.3 }, pos: { x: 0, y: r * 0.7, z: -r * 0.82 } },
  ];
  const panelMounts: PanelMount[] = [
    // 'massive' salvage hatch seated FLUSH on the +Z flank at the widest point (θ≈π/2 → the
    // surface normal IS +Z, so FACE.posZ is correct), sunk so the panel front meets the curved
    // surface instead of floating off it at a fixed height. M11 ⓔ (C63b, user note).
    { pos: new THREE.Vector3(len * 0.42, r, r * 0.85), quat: FACE.posZ(), kind: 'massive' as PanelKind },
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
    // M11 ⓑ (C62) — SUNK below the crest (y=r) so the flat panel's edges embed into the
    // curving hull instead of overhanging it (the flat-panel-on-curved-hull float, same as
    // the wrecked_tank). The Z-axis barrel is flattest along its length here.
    { pos: new THREE.Vector3(0, r - 0.22, 0), quat: FACE.posY(), kind: 'fuselage' as PanelKind },
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

/** M6 POI-breadth (campaign 2026-07-09, cycle 5) — LATTICE COMMS MAST: a tall square-section
 *  guyed truss tower, the one silhouette absent from the POI set (everything else is a hull,
 *  a barrel, a bus, or scatter — nothing is TALL + THIN). Built along +Y so a standalone
 *  assembler `liftToGround`s it standing; the archetype gives it a hard crash-LEAN (a felled
 *  relay tower). Collision = an envelope CYLINDER over the truss + a base-housing box (mirrors
 *  dorsalMast: the individual lattice members are decoration/structural covered by the
 *  envelope, so the player bumps the tower as one solid mast). Determinism: phash only. */
export function latticeMast(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const H = 5.8 + phash(seed, 1) * 2.5;        // 5.8–8.3m — the tall read
  const hw = 0.30 + phash(seed, 2) * 0.10;     // truss half-width (0.30–0.40) at the corners
  const chordR = 0.055;                         // corner-chord half-thickness
  // Equipment housing — TALL + wide enough to carry the salvage panel (0.45×0.70m) on a
  // CLEAN front face with margin (the panel was overhanging a short housing + colliding with
  // the front louvres). Louvres now live on the SIDE faces; the front +Z is the panel bay.
  const baseH = 1.05 + phash(seed, 3) * 0.25;  // 1.05–1.30m
  const baseHW = hw + 0.42;                     // ~0.72–0.82 half → ~1.5m wide face
  const colliders: ColliderSpec[] = [];

  // ── base equipment housing (collidable) ──
  const housing = new THREE.Mesh(new THREE.BoxGeometry(baseHW * 2, baseH, baseHW * 2), _hullMat);
  housing.position.y = baseH / 2; g.add(housing);
  colliders.push({ kind: 'box', half: { x: baseHW, y: baseH / 2, z: baseHW }, pos: { x: 0, y: baseH / 2, z: 0 } });
  // a plinth skirt at the foot (reads as a poured base, hides the sand seam) — decoration
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(baseHW * 2.18, 0.16, baseHW * 2.18), _hullDarkMat);
  plinth.position.y = 0.08; plinth.userData.isWreckDecoration = true; g.add(plinth);
  // a shallow RECESSED bay framing the salvage panel on the clean front (+Z) face — decoration.
  const bay = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.06), _hullDarkMat);
  bay.position.set(0, baseH * 0.52, baseHW + 0.01); bay.userData.isWreckDecoration = true; g.add(bay);
  // vent louvres on the SIDE faces (±X), clear of the front panel bay — decoration.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const lv = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, baseHW * 1.2), _hullDarkMat);
      lv.position.set(sx * (baseHW + 0.02), baseH * (0.32 + i * 0.2), 0);
      lv.userData.isWreckDecoration = true; g.add(lv);
    }
  }

  // ── 4 vertical corner chords (structural — covered by the envelope cylinder) ──
  const mastBase = baseH, mastH = H - baseH;
  const corners: Array<[number, number]> = [[hw, hw], [hw, -hw], [-hw, hw], [-hw, -hw]];
  for (const [cx, cz] of corners) {
    const chord = new THREE.Mesh(new THREE.BoxGeometry(chordR * 2, mastH, chordR * 2), _hullMat);
    chord.position.set(cx, mastBase + mastH / 2, cz);
    g.add(chord);
  }
  // ── bay bracing: per bay, a horizontal ring + a zig-zag diagonal on each face (decoration) ──
  const nBays = Math.max(5, Math.round(mastH / 1.0));
  const bayH = mastH / nBays;
  const faces: Array<[number, number, number, number]> = [
    [hw, hw, hw, -hw], [hw, -hw, -hw, -hw], [-hw, -hw, -hw, hw], [-hw, hw, hw, hw],   // 4 side faces (a→b corners)
  ];
  for (let b = 0; b < nBays; b++) {
    const y0 = mastBase + b * bayH, y1 = y0 + bayH;
    // horizontal ring at the top of every bay (4 short bars)
    for (const [ax, az, bx, bz] of faces) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const len = Math.hypot(bx - ax, bz - az);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, chordR * 1.5, chordR * 1.5), _hullDarkMat);
      bar.position.set(mx, y1, mz);
      bar.rotation.y = -Math.atan2(bz - az, bx - ax);
      bar.userData.isWreckDecoration = true; g.add(bar);
    }
    // one diagonal per face, alternating direction per bay (the lattice zig-zag)
    for (const [ax, az, bx, bz] of faces) {
      const up = (b % 2 === 0);
      const p0y = up ? y0 : y1, p1y = up ? y1 : y0;
      const midX = (ax + bx) / 2, midZ = (az + bz) / 2, midY = (p0y + p1y) / 2;
      const dLen = Math.hypot(bx - ax, bz - az, bayH);
      const diag = new THREE.Mesh(new THREE.BoxGeometry(chordR * 1.4, dLen, chordR * 1.4), _hullDarkMat);
      const dir = new THREE.Vector3(bx - ax, p1y - p0y, bz - az).normalize();
      diag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      diag.position.set(midX, midY, midZ);
      diag.userData.isWreckDecoration = true; g.add(diag);
    }
  }
  // envelope cylinder covering the 4 chords (corner distance hw·√2)
  colliders.push({ kind: 'cylinder', halfHeight: mastH / 2, radius: hw * 1.52 + chordR, pos: { x: 0, y: mastBase + mastH / 2, z: 0 } });

  // ── top gear: a crossarm with a dish + two whip antennae (decoration) ──
  const armLen = 1.1 + phash(seed, 5) * 0.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.12, 0.12), _hullMat);
  arm.position.set(0, H - 0.35, 0); arm.userData.isWreckDecoration = true; g.add(arm);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.09, 14), _rustMat);
  dish.rotation.set(Math.PI / 2.3, 0, 0);
  dish.position.set(armLen * 0.42, H - 0.35, 0.14); dish.userData.isWreckDecoration = true; g.add(dish);
  for (const sx of [-1, 1]) {
    const whipLen = 1.1 + phash(seed, 6 + sx) * 0.7;
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, whipLen, 6), _hullDarkMat);
    // weathered lean (per side, phash-varied) so they don't read as pristine goalposts;
    // the pivot is the crossarm mount so the base stays put and the tip splays outward.
    whip.rotation.z = sx * (0.12 + phash(seed, 8 + sx) * 0.18);
    whip.rotation.x = (phash(seed, 12 + sx) - 0.5) * 0.16;
    whip.position.set(sx * armLen * 0.4, H - 0.35 + whipLen / 2, 0);
    whip.userData.isWreckDecoration = true; g.add(whip);
  }
  // a small beacon drum at the very top
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 8), _rustMat);
  beacon.position.y = H + 0.02; beacon.userData.isWreckDecoration = true; g.add(beacon);

  // ── 3 slack guy wires from ~0.66·H down to ground anchors (decoration) ──
  const guyY = mastBase + mastH * 0.62;
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + phash(seed, 20) * Math.PI;
    const ax = Math.cos(ang) * 1.9, az = Math.sin(ang) * 1.9;
    const from = new THREE.Vector3(0, guyY, 0), to = new THREE.Vector3(ax, 0.05, az);
    const mid = from.clone().lerp(to, 0.5); mid.y -= 0.18;   // slight catenary sag
    const len = from.distanceTo(to);
    const guy = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 4), _hullDarkMat);
    guy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    guy.position.copy(from.clone().lerp(to, 0.5)); guy.userData.isWreckDecoration = true; g.add(guy);
    // a small ground anchor block
    const anc = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), _hullMat);
    anc.position.set(ax, 0.08, az); anc.userData.isWreckDecoration = true; g.add(anc);
  }

  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negY(), radius: baseHW, tag: 'base' }];
  const panelMounts: PanelMount[] = [
    // centered on the clean front (+Z) panel bay — fits with margin now the housing is taller.
    { pos: new THREE.Vector3(0, baseH * 0.52, baseHW), quat: FACE.posZ(), kind: 'escape_pod' },
  ];
  const bbox = new THREE.Box3(
    new THREE.Vector3(-2.1, 0, -2.1),
    new THREE.Vector3(2.1, H + 0.4, 2.1),
  );
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

/** M6 POI-breadth A2 (campaign 2026-07-09 cycle 6) — PIPE SEGMENT: one length of a big
 *  buried freight/coolant pipeline. Built along +Z (like hullBarrel) so the assembler lays
 *  a run along a line + undulates each segment above/below the sand (surfacing/diving). A
 *  bolted flange ring at each end + a weld seam + a valve stub greeble. Collision = the
 *  segment cylinder (flanges/greebles are decoration). Determinism: phash only. */
export function pipeSegment(seed: number, len: number, r: number): BuiltComponent {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), _hullMat);
  body.rotation.x = Math.PI / 2; g.add(body);   // axis along +Z
  // bolted flange rings at both ends (the joint collars) — decoration, but real depth
  for (const ez of [-len / 2, len / 2]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.14, 14), _hullDarkMat);
    flange.rotation.x = Math.PI / 2; flange.position.z = ez; flange.userData.isWreckDecoration = true; g.add(flange);
  }
  // a mid weld seam + a corroded valve stub on top (≥10cm depth, rule 7)
  const seam = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.12, 12), _hullDarkMat);
  seam.rotation.x = Math.PI / 2; seam.position.z = len * (phash(seed, 3) - 0.5) * 0.4;
  seam.userData.isWreckDecoration = true; g.add(seam);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 8), _rustMat);
  stub.position.set(0, r + 0.14, len * (phash(seed, 4) - 0.5) * 0.5);
  stub.userData.isWreckDecoration = true; g.add(stub);
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: len / 2, radius: r, pos: { x: 0, y: 0, z: 0 }, quat: FACE.posY() },
  ];
  const sockets: Socket[] = [
    { name: 'aft', pos: new THREE.Vector3(0, 0, -len / 2), quat: FACE.negZ(), radius: r, tag: 'axialIn' },
    { name: 'fwd', pos: new THREE.Vector3(0, 0, len / 2), quat: FACE.posZ(), radius: r, tag: 'axialOut' },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-r * 1.2, -r * 1.2, -len / 2), new THREE.Vector3(r * 1.2, r * 1.2, len / 2));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

/** M6 A2 — PIPE JUNCTION: the manifold hub where the run ties in. A vertical drum + flange
 *  stubs on the cardinal faces (pipe tie-ins) + a valve handwheel on top + an access housing
 *  carrying the salvage panel (kept PROUD so the terrain-audit sees it). Built at ground with
 *  the drum along +Y. Collision = the drum cylinder + the housing box. */
export function pipeJunction(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const R = 0.95 + phash(seed, 1) * 0.3;        // drum radius
  const H = 1.5 + phash(seed, 2) * 0.5;         // drum height
  const colliders: ColliderSpec[] = [];
  // manifold drum (vertical)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.05, H, 16), _hullMat);
  drum.position.y = H / 2; g.add(drum);
  colliders.push({ kind: 'cylinder', halfHeight: H / 2, radius: R * 1.05, pos: { x: 0, y: H / 2, z: 0 } });
  // hoop bands on the drum
  for (const ty of [0.28, 0.62]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.06, 6, 18), _hullDarkMat);
    hoop.rotation.x = Math.PI / 2; hoop.position.y = H * ty; hoop.userData.isWreckDecoration = true; g.add(hoop);
  }
  // flange tie-in stubs on ±X and ±Z (short fat pipes) — decoration
  const stubR = R * 0.5;
  for (const [dx, dz, ry] of [[1, 0, 0], [-1, 0, 0], [0, 1, Math.PI / 2], [0, -1, Math.PI / 2]] as Array<[number, number, number]>) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(stubR, stubR, R * 1.4, 12), _hullDarkMat);
    stub.rotation.z = Math.PI / 2; stub.rotation.y = ry;
    stub.position.set(dx * R * 1.1, H * 0.42, dz * R * 1.1);
    stub.userData.isWreckDecoration = true; g.add(stub);
  }
  // valve handwheel on top (a torus + spokes) — decoration
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20), _rustMat);
  wheel.position.y = H + 0.28; g.add(wheel);
  wheel.userData.isWreckDecoration = true;
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.05), _rustMat);
    spoke.rotation.y = (i / 3) * Math.PI; spoke.position.y = H + 0.28;
    spoke.userData.isWreckDecoration = true; g.add(spoke);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), _hullDarkMat);
  stem.position.y = H + 0.05; stem.userData.isWreckDecoration = true; g.add(stem);
  // access housing box carrying the salvage panel (kept proud)
  const boxW = R * 1.1, boxH = 0.9, boxD = 0.4;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), _hullMat);
  housing.position.set(0, boxH / 2, R + boxD / 2 - 0.05); g.add(housing);
  colliders.push({ kind: 'box', half: { x: boxW / 2, y: boxH / 2, z: boxD / 2 }, pos: { x: 0, y: boxH / 2, z: R + boxD / 2 - 0.05 } });
  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(0, boxH * 0.55, R + boxD - 0.05), quat: FACE.posZ(), kind: 'cargo_container' },
  ];
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negY(), radius: R, tag: 'base' }];
  const bbox = new THREE.Box3(new THREE.Vector3(-R * 1.2, 0, -R * 1.2), new THREE.Vector3(R * 1.2, H + 0.6, R + boxD));
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

/** M6 POI-breadth A3 (campaign 2026-07-09 cycle 7) — CARGO CRAWLER body: a tracked desert
 *  hauler wreck (cab + cargo bed riding on two track bogies), the BULKY-GROUND-VEHICLE
 *  silhouette (contrast to the vertical mast + horizontal pipeline). Built facing +Z; the
 *  archetype cants + beds it (bogged/toppled). Colliders: cab box + bed box + 2 bogie boxes;
 *  road wheels + tread lugs are decoration. Salvage panel on the cab flank. phash only. */
export function crawlerBody(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const bodyW = 2.2 + phash(seed, 1) * 0.5;       // hull width (between the tracks)
  const bedLen = 4.0 + phash(seed, 2) * 1.4;      // cargo bed length
  const cabLen = 1.8 + phash(seed, 3) * 0.5;
  const trackH = 0.72, trackW = 0.62;
  const bogieLen = bedLen + cabLen * 0.7;
  const hullY = trackH;                             // hull rides on top of the tracks

  // ── two track bogies (±X), each a frame box + rounded end drums + road wheels + tread lugs ──
  const halfTrack = bodyW / 2 + trackW / 2 - 0.05;
  for (const sx of [-1, 1]) {
    const bx = sx * halfTrack;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(trackW, trackH, bogieLen), _hullDarkMat);
    frame.position.set(bx, trackH / 2, bedLen * 0.5 - bogieLen * 0.5 + cabLen * 0.5); g.add(frame);
    const cz = frame.position.z;
    colliders.push({ kind: 'box', half: { x: trackW / 2, y: trackH / 2, z: bogieLen / 2 }, pos: { x: bx, y: trackH / 2, z: cz } });
    // rounded end drums (idler/sprocket) — axis along X (transverse), decoration
    for (const ez of [-bogieLen / 2, bogieLen / 2]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(trackH / 2, trackH / 2, trackW, 12), _hullDarkMat);
      drum.rotation.z = Math.PI / 2; drum.position.set(bx, trackH / 2, cz + ez);
      drum.userData.isWreckDecoration = true; g.add(drum);
    }
    // road wheels along the bottom (decoration)
    const nWheel = 4 + Math.floor(phash(seed, 10 + sx) * 2);
    for (let w = 0; w < nWheel; w++) {
      const wz = cz - bogieLen / 2 + bogieLen * (w + 0.5) / nWheel;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(trackH * 0.42, trackH * 0.42, trackW * 1.05, 10), _rustMat);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(bx, trackH * 0.42, wz);
      wheel.userData.isWreckDecoration = true; g.add(wheel);
    }
    // tread lugs around the visible top run (decoration — thin bars give the track texture)
    const nLug = 8;
    for (let k = 0; k < nLug; k++) {
      const lz = cz - bogieLen / 2 + bogieLen * (k + 0.5) / nLug;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(trackW * 1.08, 0.1, 0.22), _rustMat);
      lug.position.set(bx, trackH - 0.03, lz); lug.userData.isWreckDecoration = true; g.add(lug);
    }
  }

  // ── cargo bed (rear) — an open-topped hauler bed with low side walls ──
  const bedH = 1.05 + phash(seed, 4) * 0.4;
  const bedZ = -cabLen * 0.5;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bedH, bedLen), _hullMat);
  bed.position.set(0, hullY + bedH / 2, bedZ); g.add(bed);
  colliders.push({ kind: 'box', half: { x: bodyW / 2, y: bedH / 2, z: bedLen / 2 }, pos: { x: 0, y: hullY + bedH / 2, z: bedZ } });
  // bed side-wall ribs (decoration, ≥10cm)
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, bedH * 0.7, 0.16), _hullDarkMat);
      rib.position.set(sx * (bodyW / 2 - 0.02), hullY + bedH * 0.6, bedZ - bedLen / 2 + bedLen * (k + 0.5) / 4);
      rib.userData.isWreckDecoration = true; g.add(rib);
    }
  }

  // ── cab (front, +Z) — a taller boxy cab with a dark windscreen recess ──
  const cabH = 1.5 + phash(seed, 5) * 0.4;
  const cabZ = bedZ + bedLen / 2 + cabLen / 2;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.92, cabH, cabLen), _hullMat);
  cab.position.set(0, hullY + cabH / 2, cabZ); g.add(cab);
  colliders.push({ kind: 'box', half: { x: bodyW * 0.46, y: cabH / 2, z: cabLen / 2 }, pos: { x: 0, y: hullY + cabH / 2, z: cabZ } });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.7, cabH * 0.42, 0.14), _hullDarkMat);
  glass.position.set(0, hullY + cabH * 0.62, cabZ + cabLen / 2 - 0.02); glass.userData.isWreckDecoration = true; g.add(glass);
  // exhaust stack + a roof vent (decoration)
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.9, 8), _rustMat);
  stack.position.set(bodyW * 0.3, hullY + cabH + 0.35, cabZ - cabLen * 0.3); stack.userData.isWreckDecoration = true; g.add(stack);

  // ══ M6 A3 DETAIL PASS (2026-07-09) — de-blockify: fenders, running boards, a truck cab face
  //    (grille/headlights/bumper/pushbar/doors), a cargo frame (posts/rail/crates/tailgate), and
  //    panel seams. ALL thin/brushable DECORATION (isWreckDecoration) so the cab/bed/bogie box
  //    colliders stay exact (rule 9) — like the mast lattice + tank ribs, surface detail only. ══
  const bogieCz = bedLen * 0.5 - bogieLen * 0.5 + cabLen * 0.5;
  const dec = (m: THREE.Mesh) => { m.userData.isWreckDecoration = true; g.add(m); return m; };
  const frontZ = cabZ + cabLen / 2;

  for (const sx of [-1, 1]) {
    // track FENDER (guard over the tread) + a running board below the cab door
    dec(new THREE.Mesh(new THREE.BoxGeometry(trackW + 0.26, 0.13, bogieLen * 0.94), _hullMat))
      .position.set(sx * halfTrack, trackH + 0.05, bogieCz);
    dec(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, cabLen * 0.8), _hullDarkMat))
      .position.set(sx * (bodyW * 0.46 + 0.13), hullY + 0.05, cabZ);
    // door outline on each cab flank
    dec(new THREE.Mesh(new THREE.BoxGeometry(0.05, cabH * 0.62, cabLen * 0.62), _hullDarkMat))
      .position.set(sx * bodyW * 0.46, hullY + cabH * 0.42, cabZ);
    // vertical panel seams breaking up the long bed flank
    dec(new THREE.Mesh(new THREE.BoxGeometry(0.04, bedH * 0.86, 0.05), _hullDarkMat))
      .position.set(sx * (bodyW / 2 - 0.01), hullY + bedH * 0.5, bedZ);
  }

  // CAB FRONT — a grille + headlights + a bumper/pushbar (windscreen stays the upper band)
  const grille = dec(new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.6, cabH * 0.3, 0.06), _hullDarkMat));
  grille.position.set(0, hullY + cabH * 0.27, frontZ + 0.01);
  for (let s = 0; s < 4; s++) {
    dec(new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.58, 0.03, 0.1), _rustMat))
      .position.set(0, hullY + cabH * (0.17 + s * 0.06), frontZ + 0.02);
  }
  for (const sx of [-1, 1]) {
    dec(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.1), _rustMat))
      .position.set(sx * bodyW * 0.34, hullY + cabH * 0.46, frontZ + 0.03);          // headlight
    dec(new THREE.Mesh(new THREE.BoxGeometry(0.1, cabH * 0.5, 0.1), _hullDarkMat))
      .position.set(sx * bodyW * 0.36, hullY + cabH * 0.3, frontZ + 0.11);           // pushbar upright
  }
  dec(new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.98, 0.16, 0.16), _hullDarkMat))
    .position.set(0, hullY + 0.2, frontZ + 0.08);                                     // front bumper/pushbar

  // roof beacon
  dec(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8), _rustMat))
    .position.set(-bodyW * 0.28, hullY + cabH + 0.07, cabZ + cabLen * 0.2);

  // CARGO FRAME on the bed — 4 corner posts + top rails + a dropped tailgate + a couple crates
  const bedTopY = hullY + bedH, postH = 0.68;
  const bedFrontZ = bedZ + bedLen / 2, bedBackZ = bedZ - bedLen / 2;
  for (const sx of [-1, 1]) {
    for (const pz of [bedBackZ + 0.1, bedFrontZ - 0.1]) {
      dec(new THREE.Mesh(new THREE.BoxGeometry(0.1, postH, 0.1), _hullDarkMat))
        .position.set(sx * (bodyW / 2 - 0.06), bedTopY + postH / 2, pz);
    }
    dec(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, bedLen - 0.2), _hullDarkMat))
      .position.set(sx * (bodyW / 2 - 0.06), bedTopY + postH, bedZ);                   // top rail
  }
  const tailgate = dec(new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.96, bedH * 0.6, 0.1), _hullMat));
  tailgate.position.set(0, hullY + bedH * 0.3, bedBackZ - 0.16); tailgate.rotation.x = -0.6;   // dropped open
  for (let c = 0; c < 2; c++) {
    const crate = dec(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.58, 0.66), _rustMat));
    crate.position.set((phash(seed, 60 + c) - 0.5) * bodyW * 0.45, bedTopY + 0.31, bedZ + (phash(seed, 62 + c) - 0.5) * bedLen * 0.5);
    crate.rotation.set((phash(seed, 64 + c) - 0.5) * 0.35, phash(seed, 66 + c) * Math.PI, (phash(seed, 68 + c) - 0.5) * 0.35);
  }

  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(bodyW * 0.46, hullY + cabH * 0.45, cabZ), quat: FACE.posX(), kind: 'cargo_container' },
  ];
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negY(), radius: bodyW * 0.6, tag: 'base' }];
  const topY = hullY + Math.max(bedH, cabH) + 0.8;
  const bbox = new THREE.Box3(
    new THREE.Vector3(-halfTrack - trackW, 0, bedZ - bedLen / 2 - 0.5),
    new THREE.Vector3(halfTrack + trackW, topY, cabZ + cabLen / 2 + 0.3),
  );
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

/** M9 archetype 1 (campaign Sharpen&Deepen) — REFINERY STACK: a fuel-refinery / cracking-tower
 *  ruin. The heavy VERTICAL-INDUSTRIAL silhouette the POI set lacked (relay_mast is thin comms;
 *  cargo_crawler is a low tracked hauler): a tall tapered distillation COLUMN buckled + leaning
 *  off a planted foundation (banded with hoops, ringed by walkway PLATFORMS + a ladder), a big
 *  vertical storage DRUM, a spherical pressure TANK on legs (the iconic Horton sphere), a thin
 *  FLARE stack, a chunky pipe MANIFOLD tying them together, and a valve/control SKID carrying the
 *  salvage panel. Collision = column + foundation + drum + sphere + manifold + flare + skid;
 *  platforms/ladders/thin pipes/legs/hoops/greebles are decoration. Determinism: phash only. */
export function refineryStack(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const dec = (m: THREE.Mesh) => { m.userData.isWreckDecoration = true; g.add(m); return m; };
  const cylBetween = (p0: THREE.Vector3, p1: THREE.Vector3, r: number, mat: THREE.Material, seg = 8) => {
    const dir = new THREE.Vector3().subVectors(p1, p0); const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    m.position.copy(p0).addScaledVector(dir, 0.5);
    return m;
  };

  // ── Cracking COLUMN — a planted foundation drum + a tall tapered stack leaning off it
  //    (buckled at the base: the industry crashed). Built in a local +Y subgroup, then leaned. ──
  const baseH = 0.9 + phash(seed, 1) * 0.4;
  const rBot = 1.35 + phash(seed, 2) * 0.4;               // 1.35–1.75m
  const rTop = rBot * (0.58 + phash(seed, 3) * 0.14);
  const H = 9.6 + phash(seed, 4) * 3.0;                   // 9.6–12.6m stack above the foundation — floor RAISED so the column always out-tops the drum (the hero vertical)
  const lean = 0.11 + phash(seed, 5) * 0.11;             // 0.11–0.22 rad lean toward +X
  const qLean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean);
  const pivot = new THREE.Vector3(0, baseH, 0);

  // foundation (upright, planted — collidable)
  const found = new THREE.Mesh(new THREE.CylinderGeometry(rBot * 1.04, rBot * 1.16, baseH, 16), _hullMat);
  found.position.y = baseH / 2; g.add(found);
  colliders.push({ kind: 'cylinder', halfHeight: baseH / 2, radius: rBot * 1.16, pos: { x: 0, y: baseH / 2, z: 0 } });
  dec(new THREE.Mesh(new THREE.BoxGeometry(rBot * 3.0, 0.2, rBot * 3.0), _hullDarkMat)).position.y = 0.1;   // skirt pad hides the sand seam

  // the leaning stack + all its dressing, in a LOCAL subgroup (+Y up the column) then leaned
  const col = new THREE.Group();
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, H, 16), _hullMat);
  stack.position.y = H / 2; col.add(stack);              // structural (collidable via the leaned cylinder below)
  const radAt = (f: number) => rBot + (rTop - rBot) * f;
  // hoop bands
  for (let i = 0; i < 7; i++) {
    const f = 0.06 + i * 0.14;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(radAt(f) + 0.04, 0.06, 6, 18), _hullDarkMat);
    hoop.rotation.x = Math.PI / 2; hoop.position.y = f * H; hoop.userData.isWreckDecoration = true; col.add(hoop);
  }
  // 2 walkway PLATFORMS (ring grating + railing + stanchions)
  for (const f of [0.34, 0.66]) {
    const pr = radAt(f) + 0.55;
    const grate = new THREE.Mesh(new THREE.TorusGeometry(pr, 0.09, 6, 22), _rustMat);
    grate.rotation.x = Math.PI / 2; grate.position.y = f * H; grate.userData.isWreckDecoration = true; col.add(grate);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(pr, 0.035, 5, 22), _hullDarkMat);
    rail.rotation.x = Math.PI / 2; rail.position.y = f * H + 0.5; rail.userData.isWreckDecoration = true; col.add(rail);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), _hullDarkMat);
      post.position.set(Math.cos(a) * pr, f * H + 0.25, Math.sin(a) * pr);
      post.userData.isWreckDecoration = true; col.add(post);
    }
  }
  // ladder up the +Z flank (2 rails + rungs)
  const ladTop = H * 0.68, ladZ = rBot + 0.12;
  for (const sx of [-0.16, 0.16]) {
    const railM = new THREE.Mesh(new THREE.BoxGeometry(0.05, ladTop, 0.05), _hullDarkMat);
    railM.position.set(sx, ladTop / 2, ladZ); railM.userData.isWreckDecoration = true; col.add(railM);
  }
  for (let y = 0.4; y < ladTop; y += 0.42) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.05), _rustMat);
    rung.position.set(0, y, ladZ); rung.userData.isWreckDecoration = true; col.add(rung);
  }
  // top cap dome + 2 outlet stubs bending off the crown
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.5, rTop, rTop * 1.1, 14), _hullMat);
  cap.position.y = H + rTop * 0.5; cap.userData.isWreckDecoration = true; col.add(cap);
  for (const sz of [-1, 1]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, rTop * 1.3, 10), _rustMat);
    stub.rotation.z = Math.PI / 2.4; stub.position.set(0, H + rTop * 0.8, sz * rTop * 0.6);
    stub.userData.isWreckDecoration = true; col.add(stub);
  }
  col.position.copy(pivot); col.quaternion.copy(qLean); g.add(col);
  // leaned-stack collider (local centre (0,H/2,0) → root)
  const stackC = new THREE.Vector3(0, H / 2, 0).applyQuaternion(qLean).add(pivot);
  colliders.push({ kind: 'cylinder', halfHeight: H / 2, radius: rBot * 1.02,
    pos: { x: stackC.x, y: stackC.y, z: stackC.z }, quat: { x: qLean.x, y: qLean.y, z: qLean.z, w: qLean.w } });

  // ── Vertical storage DRUM (collidable) — hoops + a domed roof + a manway scale-cue ──
  const drumR = 1.7 + phash(seed, 6) * 0.5;
  const drumH = 2.9 + phash(seed, 7) * 1.4;              // capped SHORTER than the column so it never competes as the hero mass
  const drumX = -(rBot + drumR + 1.3), drumZ = 1.8;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(drumR, drumR, drumH, 18), _hullMat);
  drum.position.set(drumX, drumH / 2, drumZ); g.add(drum);
  colliders.push({ kind: 'cylinder', halfHeight: drumH / 2, radius: drumR, pos: { x: drumX, y: drumH / 2, z: drumZ } });
  const drumRoof = dec(new THREE.Mesh(new THREE.CylinderGeometry(drumR * 0.2, drumR * 1.02, drumR * 0.45, 18), _hullMat));   // LOW conical fixed-roof tank (was a hemisphere → read as a bullet nose)
  drumRoof.position.set(drumX, drumH + drumR * 0.22, drumZ);
  for (const ty of [0.22, 0.5, 0.78]) {
    const hb = dec(new THREE.Mesh(new THREE.TorusGeometry(drumR + 0.03, 0.06, 6, 20), _hullDarkMat));
    hb.rotation.x = Math.PI / 2; hb.position.set(drumX, drumH * ty, drumZ);
  }
  const manway = dec(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), _hullDarkMat));
  manway.rotation.x = Math.PI / 2; manway.position.set(drumX, drumH * 0.42, drumZ + drumR);
  for (let i = 0; i < 4; i++) {   // access rungs on the drum flank (scale cue)
    const rung = dec(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), _rustMat));
    rung.position.set(drumX, drumH * 0.42 - 0.5 - i * 0.34, drumZ + drumR + 0.06);
  }

  // ── Spherical pressure TANK on legs (collidable ball) — the iconic Horton sphere ──
  const sphR = 1.5 + phash(seed, 8) * 0.45;
  const legH = 1.2 + phash(seed, 9) * 0.4;
  const sphX = -(rBot + sphR + 1.0), sphZ = -2.9, sphY = legH + sphR;
  const sphC = new THREE.Vector3(sphX, sphY, sphZ);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(sphR, 18, 14), _hullMat);
  sph.position.copy(sphC); g.add(sph);
  colliders.push({ kind: 'ball', radius: sphR, pos: { x: sphX, y: sphY, z: sphZ } });
  const eqb = dec(new THREE.Mesh(new THREE.TorusGeometry(sphR + 0.02, 0.07, 6, 22), _hullDarkMat));
  eqb.position.copy(sphC);
  for (let i = 0; i < 6; i++) {   // 6 splayed support legs + cross-braces (decoration)
    const a = (i / 6) * Math.PI * 2;
    const foot = new THREE.Vector3(sphX + Math.cos(a) * sphR * 0.95, 0, sphZ + Math.sin(a) * sphR * 0.95);
    const attach = new THREE.Vector3(sphX + Math.cos(a) * sphR * 0.6, sphY - sphR * 0.6, sphZ + Math.sin(a) * sphR * 0.6);
    dec(cylBetween(foot, attach, 0.11, _rustMat, 7));
    const a2 = ((i + 1) / 6) * Math.PI * 2;   // brace ring near mid-leg
    const b0 = new THREE.Vector3(sphX + Math.cos(a) * sphR * 0.78, legH * 0.5, sphZ + Math.sin(a) * sphR * 0.78);
    const b1 = new THREE.Vector3(sphX + Math.cos(a2) * sphR * 0.78, legH * 0.5, sphZ + Math.sin(a2) * sphR * 0.78);
    dec(cylBetween(b0, b1, 0.045, _hullDarkMat, 5));
  }

  // ── Thin FLARE stack (collidable, slightly bent) + a crown of flare tips ──
  const flareH = H * 0.82 + phash(seed, 10) * 1.6;
  const flareR = 0.26 + phash(seed, 11) * 0.08;
  const flareBend = (phash(seed, 12) - 0.5) * 0.16;
  const flareX = rBot + 2.0, flareZ = -2.3;
  const qFlare = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), flareBend);
  const flareBase = new THREE.Vector3(flareX, 0, flareZ);
  const flareC = new THREE.Vector3(0, flareH / 2, 0).applyQuaternion(qFlare).add(flareBase);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(flareR * 0.8, flareR, flareH, 12), _hullMat);
  flare.position.copy(flareC); flare.quaternion.copy(qFlare); g.add(flare);
  colliders.push({ kind: 'cylinder', halfHeight: flareH / 2, radius: flareR, pos: { x: flareC.x, y: flareC.y, z: flareC.z }, quat: { x: qFlare.x, y: qFlare.y, z: qFlare.z, w: qFlare.w } });
  const flareTop = new THREE.Vector3(0, flareH, 0).applyQuaternion(qFlare).add(flareBase);
  const crown = dec(new THREE.Mesh(new THREE.CylinderGeometry(flareR * 2.5, flareR * 1.0, 0.85, 12), _hullDarkMat));   // a clearer flared bell tip
  crown.position.copy(flareTop).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(qFlare), 0.3); crown.quaternion.copy(qFlare);
  for (let i = 0; i < 3; i++) {   // pilot-tip fingers
    const tip = dec(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.5, 6), _rustMat));
    tip.position.copy(flareTop).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(qFlare), 0.7 + i * 0.05);
    tip.position.x += (i - 1) * 0.12;
  }

  // ── Chunky pipe MANIFOLD (collidable) low along X, tying the column base to the drum ──
  const manR = 0.42 + phash(seed, 13) * 0.12;
  const manY = 0.72, manZ = 0.95;
  const manX0 = drumX + drumR * 0.4, manX1 = 0.4;
  const manLen = Math.abs(manX1 - manX0), manCx = (manX0 + manX1) / 2;
  const man = new THREE.Mesh(new THREE.CylinderGeometry(manR, manR, manLen, 14), _hullMat);
  man.rotation.z = Math.PI / 2; man.position.set(manCx, manY, manZ); g.add(man);
  colliders.push({ kind: 'cylinder', halfHeight: manLen / 2, radius: manR, pos: { x: manCx, y: manY, z: manZ }, quat: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 } });
  for (const ex of [manX0, manX1]) {   // flange collars
    const fl = dec(new THREE.Mesh(new THREE.CylinderGeometry(manR * 1.2, manR * 1.2, 0.14, 14), _hullDarkMat));
    fl.rotation.z = Math.PI / 2; fl.position.set(ex, manY, manZ);
  }
  // connecting pipes + elbows (all decoration): manifold→column base, manifold→drum, drum→sphere, column→flare
  dec(cylBetween(new THREE.Vector3(manX1, manY, manZ), new THREE.Vector3(0.2, baseH * 0.7, manZ * 0.6), manR * 0.7, _rustMat));
  dec(cylBetween(new THREE.Vector3(manX0, manY, manZ), new THREE.Vector3(drumX, drumH * 0.3, drumZ), manR * 0.7, _rustMat));
  dec(cylBetween(new THREE.Vector3(drumX, drumH * 0.55, drumZ - drumR), new THREE.Vector3(sphX, sphY - sphR * 0.3, sphZ + sphR), 0.24, _rustMat));
  dec(cylBetween(new THREE.Vector3(0.3, baseH + 1.2, -manZ * 0.4), new THREE.Vector3(flareX, flareH * 0.28, flareZ), 0.22, _rustMat));
  for (const e of [new THREE.Vector3(manX0, manY, manZ), new THREE.Vector3(manX1, manY, manZ), new THREE.Vector3(drumX, drumH * 0.3, drumZ)]) {
    dec(new THREE.Mesh(new THREE.SphereGeometry(manR * 1.15, 8, 6), _hullDarkMat)).position.copy(e);
  }
  // a short pipe RACK (2 posts + a cross beam) under the drum→sphere run
  for (const px of [drumX + 0.6, sphX - 0.4]) {
    const post = dec(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), _hullDarkMat));
    post.position.set(px, 0.7, (drumZ + sphZ) / 2);
  }
  // a mid-height TRANSFER LINE bridging the column to the drum roof — the classic refinery
  // overhead-plumbing read (decoration; runs on a couple of pipe-rack posts).
  const colMid = new THREE.Vector3(0, 0.42 * H, 0).applyQuaternion(qLean).add(pivot);
  const drumTop = new THREE.Vector3(drumX + drumR * 0.4, drumH + drumR * 0.2, drumZ);
  dec(cylBetween(colMid, drumTop, 0.2, _rustMat));
  dec(cylBetween(new THREE.Vector3(drumTop.x, drumTop.y, drumZ), new THREE.Vector3(drumTop.x, 0, drumZ), 0.14, _hullDarkMat));   // riser post to ground

  // ── Valve / control SKID (collidable) carrying the salvage panel on its clean +Z face ──
  const conW = 1.2, conH = 1.0, conD = 0.72;
  const conX = rBot + 1.1, conZ = 2.5;
  const con = new THREE.Mesh(new THREE.BoxGeometry(conW, conH, conD), _hullMat);
  con.position.set(conX, conH / 2, conZ); g.add(con);
  colliders.push({ kind: 'box', half: { x: conW / 2, y: conH / 2, z: conD / 2 }, pos: { x: conX, y: conH / 2, z: conZ } });
  const top = dec(new THREE.Mesh(new THREE.BoxGeometry(conW, 0.1, conD * 0.8), _hullDarkMat));   // slanted control top
  top.position.set(conX, conH + 0.02, conZ); top.rotation.x = -0.25;
  for (const wx of [-0.32, 0.32]) {   // valve handwheels on top
    const wheel = dec(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14), _rustMat));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(conX + wx, conH + 0.14, conZ - 0.15);
  }
  const gaugeBank = dec(new THREE.Mesh(new THREE.BoxGeometry(conW * 0.7, 0.28, 0.12), _hullDarkMat));   // gauge panel on -Z (back)
  gaugeBank.position.set(conX, conH * 0.7, conZ - conD / 2 - 0.06);

  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(conX, conH * 0.52, conZ + conD / 2), quat: FACE.posZ(), kind: 'cargo_container' as PanelKind },
  ];
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posY(), radius: rBot, tag: 'base' }];
  g.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(g);
  bbox.min.y = 0;   // built from the ground plane up; keep liftToGround a no-op (no re-lift of the planted base)
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

// ════════════════════════════════════════════════════════════════════
// HAB DOME (M9 archetype 2, campaign Sharpen&Deepen; REBUILT 2026-07-16 per review §A4 +
// the verify:solid gate) — a WALKABLE two-dome habitat: a big dome + a smaller dome linked
// by a low arched CORRIDOR you actually walk through (dome A → tube → dome B, one continuous
// interior). The ONE ROUNDED silhouette the POI set lacked. A human-habitation ruin — someone
// lived out here, then it failed — melancholy, no bodies (D252 solitude). cool bucket.
//
// GEOMETRY (the review's four fixes + the machine gate): the whole habitat is ONE continuous
// double-skinned THICK shell lofted along +X — a "dumbbell": dome A radius RA, a walkable neck
// of radius neckR, dome B radius RB. Each circular cross-section is centred at (x, AXIS_Y, 0);
// the LOWER half sits below the sand (buried) so above ground it reads as two domes + an arched
// tube. Because the outer skin AND the inner skin are each a CLOSED surface (both poles capped
// by fans), the shell has ZERO open boundary loops (fixes the see-through / open-end defects the
// old single-skin torn spheres had). Two DOORWAYS (one per dome, +Z flank, floor→~2.1m) are cut
// through BOTH skins and JAMBED (outer rim welded to inner rim) so they stay boundary-free but
// genuinely OPEN + walkable. THICKNESS: WALL_T real wall depth (rule 7). COLLISION (rule 9): a
// PICKET wall of box colliders follows the y=0 footprint of the shell (at the inner-wall radius
// so the player stops at the visible interior wall) with a GAP at each doorway + the interior
// bore left clear → you can walk the whole run; the airlock module is a solid collided box.
// Determinism: phash only (one seedOf upstream). The old torn-sphere + floating caved-crown +
// hanging roof plates are GONE (the review's "floating cone" was the caved-crown cap).
export function habDome(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const dec = (m: THREE.Mesh) => { m.userData.isWreckDecoration = true; return m; };

  // ── dumbbell profile parameters ──
  const RA = 4.5 + phash(seed, 1) * 0.7;      // big dome 4.5–5.2m (review: bigger)
  const RB = 3.3 + phash(seed, 2) * 0.5;      // annex dome 3.3–3.8m
  const neckR = 1.95 + phash(seed, 10) * 0.2; // corridor tube radius (walkable)
  const neckLen = 2.4 + phash(seed, 3) * 0.9; // clear corridor run between the domes
  const AXIS_Y = 0.35;                         // section-circle centre height → wide floor + buried bottom
  const WALL_T = 0.3;                          // wall thickness (rule 7: substantial cross-section)
  const xA = 0;
  // dome A radius falls to neckR at xJoinA; dome B is placed neckLen beyond that.
  const xJoinA = xA + RA * Math.sqrt(Math.max(0, 1 - (neckR / RA) ** 2));
  const xB = xJoinA + neckLen + RB * Math.sqrt(Math.max(0, 1 - (neckR / RB) ** 2));
  const xPole0 = xA - RA, xPole1 = xB + RB;
  // union silhouette: two spheres + a neck cylinder bridging their join points.
  const rAt = (x: number): number => {
    const sa = RA * RA - (x - xA) * (x - xA); const ra = sa > 0 ? Math.sqrt(sa) : 0;
    const sb = RB * RB - (x - xB) * (x - xB); const rb = sb > 0 ? Math.sqrt(sb) : 0;
    const rn = (x > xA && x < xB) ? neckR : 0;
    return Math.max(ra, rb, rn);
  };

  // ── grid: M+1 stations along X, nS ring segments around each circular section ──
  const nS = 32;
  const M = 56;
  const xs: number[] = [];
  for (let i = 0; i <= M; i++) xs.push(xPole0 + (i / M) * (xPole1 - xPole0));
  const ringY = (r: number, k: number) => AXIS_Y + r * Math.cos((k / nS) * Math.PI * 2);
  const ringZ = (r: number, k: number) => r * Math.sin((k / nS) * Math.PI * 2);

  // Two DOORWAYS on the +Z flank: dome-A centre (xA) and dome-B centre (xB). A doorway removes
  // ring cells k∈[DOOR_K0,DOOR_K1) (α≈67°→112° → y from ~2.1m down through the floor into the
  // buried sill) over an x-window ±DOOR_HX around the dome centre → a floor-to-head opening.
  const DOOR_K0 = 6, DOOR_K1 = 10;
  const DOOR_HX = 1.1;   // half-width of the door window in x → a ~2.3m opening (0.8 gave ~1.6m:
                         // passable by a 1.4m player sphere with only ~11cm of slack, and that
                         // slack varied with RA across seeds. A habitat door reads better wide.)
  const doorXs = [xA, xB];
  const inDoorCell = (xmid: number, ck: number): number => {
    if (ck < DOOR_K0 || ck >= DOOR_K1) return -1;
    for (let d = 0; d < doorXs.length; d++) if (Math.abs(xmid - doorXs[d]) <= DOOR_HX) return d;
    return -1;
  };

  // ── build the shell positions (indexed, welded, smooth-normalled) ──
  const pos: number[] = [];
  const idx: number[] = [];
  const addV = (x: number, y: number, z: number): number => { pos.push(x, y, z); return pos.length / 3 - 1; };
  const outer: number[][] = []; const inner: number[][] = [];
  const outerApex0 = addV(xPole0, AXIS_Y, 0);
  const outerApex1 = addV(xPole1, AXIS_Y, 0);
  const innerApex0 = addV(xPole0 + WALL_T, AXIS_Y, 0);
  const innerApex1 = addV(xPole1 - WALL_T, AXIS_Y, 0);
  for (let i = 0; i <= M; i++) {
    outer[i] = []; inner[i] = [];
    const r = rAt(xs[i]);
    const ri = Math.max(0.04, r - WALL_T);
    for (let k = 0; k < nS; k++) {
      if (i === 0) { outer[i][k] = outerApex0; inner[i][k] = innerApex0; continue; }
      if (i === M) { outer[i][k] = outerApex1; inner[i][k] = innerApex1; continue; }
      outer[i][k] = addV(xs[i], ringY(r, k), ringZ(r, k));
      inner[i][k] = addV(xs[i], ringY(ri, k), ringZ(ri, k));
    }
  }
  const quadOuter = (a: number, b: number, c: number, d: number) => { idx.push(a, b, c, a, c, d); };   // outward
  const quadInner = (a: number, b: number, c: number, d: number) => { idx.push(a, c, b, a, d, c); };   // inward (reversed)
  // pole fans (i=0 −X tip, i=M +X tip) — always solid (doorways sit at dome centres, not the
  // poles). Winding validated against the backface gate (az90=+X pole, az270=−X pole).
  for (let k = 0; k < nS; k++) {
    const k2 = (k + 1) % nS;
    idx.push(outerApex0, outer[1][k2], outer[1][k]);                 // −X outer, outward
    idx.push(innerApex0, inner[1][k], inner[1][k2]);                 // −X inner, inward
    idx.push(outerApex1, outer[M - 1][k], outer[M - 1][k2]);         // +X outer, outward
    idx.push(innerApex1, inner[M - 1][k2], inner[M - 1][k]);         // +X inner, inward
  }
  // quad bands, skipping doorway cells on both skins
  type Rim = { i0: number; i1: number; k0: number; k1: number };
  const doorRims: Rim[] = doorXs.map(() => ({ i0: 1e9, i1: -1e9, k0: 1e9, k1: -1e9 }));
  for (let i = 1; i < M - 1; i++) {
    const xmid = (xs[i] + xs[i + 1]) / 2;
    for (let k = 0; k < nS; k++) {
      const k2 = (k + 1) % nS;
      const d = inDoorCell(xmid, k);
      if (d >= 0) {
        const rm = doorRims[d];
        rm.i0 = Math.min(rm.i0, i); rm.i1 = Math.max(rm.i1, i + 1);
        rm.k0 = Math.min(rm.k0, k); rm.k1 = Math.max(rm.k1, k + 1);
        continue;   // hole in both skins
      }
      quadOuter(outer[i][k], outer[i][k2], outer[i + 1][k2], outer[i + 1][k]);
      quadInner(inner[i][k], inner[i][k2], inner[i + 1][k2], inner[i + 1][k]);
    }
  }
  // JAMB each doorway: weld the outer rim to the inner rim around the rectangular hole so the
  // opening stays boundary-free (no open-end / see-through) yet reads as a real thick jamb.
  for (const rm of doorRims) {
    if (rm.i1 < rm.i0) continue;
    const loop: Array<[number, number]> = [];
    for (let i = rm.i0; i <= rm.i1; i++) loop.push([i, rm.k0]);                     // bottom-α edge
    for (let k = rm.k0 + 1; k <= rm.k1; k++) loop.push([rm.i1, k]);                 // +x edge
    for (let i = rm.i1 - 1; i >= rm.i0; i--) loop.push([i, rm.k1]);                 // top-α edge
    for (let k = rm.k1 - 1; k > rm.k0; k--) loop.push([rm.i0, k]);                  // -x edge
    for (let n = 0; n < loop.length; n++) {
      const [ia, ka] = loop[n]; const [ib, kb] = loop[(n + 1) % loop.length];
      const Ao = outer[ia][ka], Bo = outer[ib][kb], Ai = inner[ia][ka], Bi = inner[ib][kb];
      idx.push(Ao, Bi, Bo, Ao, Ai, Bi);   // jamb quad (winding validated against the backface gate)
    }
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shellGeo.setIndex(idx);
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, _hullMat);
  shell.userData.auditExempt = true; g.add(shell);
  // Declare the dome-A doorway as an INTENDED opening (component-LOCAL). `openend` is a topology
  // detector and cannot tell a torn hull from a front door — told to close every open loop, a
  // pass will brick up the entrance (this is exactly how the leviathan got sealed). Declaring it
  // excuses the door from `openend` and gives `walkin` the true target to aim at.
  // It lives on the GROUP, not on `shell`: the POI pipeline static-merges `shell` away (it shares
  // _hullMat with the airlock), which would take its userData with it. The group survives the
  // merge, which is why the walk-probe is stashed here too.
  g.userData.intendedOpening = {
    center: { x: xA, y: AXIS_Y, z: Math.sqrt(Math.max(0.04, RA * RA - AXIS_Y * AXIS_Y)) },
    radius: DOOR_HX,
  };

  // ── decoration: latitude hoops + meridian ribs on each dome, corridor arch ribs + junction
  //    collars, a few portholes, an airlock module, a bent dead antenna. All seated on the shell
  //    surface (attached → not floating); all thick primitives (rule 7). ──
  const domeDeco = (cx: number, R: number, sk: number) => {
    // latitude hoops at a few heights on the standing (above-sand) part of the dome
    for (const yf of [0.35, 0.62, 0.85]) {
      const y = AXIS_Y + R * yf;                        // ring centre height
      const rr = Math.sqrt(Math.max(0.04, R * R - (y - AXIS_Y) * (y - AXIS_Y))) + 0.03;
      const hoop = dec(new THREE.Mesh(new THREE.TorusGeometry(rr, 0.06, 6, 26), _hullDarkMat));
      hoop.rotation.x = Math.PI / 2; hoop.position.set(cx, y, 0); g.add(hoop);
    }
    // meridian ribs — a FULL closed torus (no open tube ends → no see-through) standing as a
    // vertical great-circle meridian; the lower half buries. Yaw around the crown.
    for (let m = 0; m < 6; m++) {
      const az = (m / 6) * Math.PI * 2 + 0.2;
      const rib = dec(new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.07, 6, 30), _hullDarkMat));
      rib.quaternion.copy(qY(az));
      rib.position.set(cx, AXIS_Y, 0); g.add(rib);
    }
    // portholes — a thick frame + a shallow recessed dark pane (depth passes the thin gate).
    // Placed on the −Z / side arc (clear of the +Z doorway) via an outward SPHERE normal:
    // elevation e above the equator + azimuth a swept around −Z.
    for (let p = 0; p < 3; p++) {
      const a = (-0.7 + p * 0.7) + (phash(sk, 40 + p) - 0.5) * 0.25;   // azimuth off −Z
      const e = 0.28 + phash(sk, 50 + p) * 0.55;                        // elevation (rad)
      const horiz = Math.cos(e);
      const nrm = new THREE.Vector3(horiz * Math.sin(a), Math.sin(e), -horiz * Math.cos(a)).normalize();
      const surf = new THREE.Vector3(cx + R * nrm.x, AXIS_Y + R * nrm.y, R * nrm.z);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
      const frame = dec(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 16), _rustMat));
      frame.position.copy(surf).addScaledVector(nrm, 0.02); frame.quaternion.copy(q); g.add(frame);
      const pane = dec(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 14), _shaftVoidMat));
      pane.position.copy(surf).addScaledVector(nrm, -0.02);
      pane.quaternion.copy(q).multiply(qX(Math.PI / 2)); g.add(pane);
    }
  };
  domeDeco(xA, RA, seed + 11);
  domeDeco(xB, RB, seed + 22);
  // corridor arch ribs across the neck + a collar at each dome junction (the airlock read)
  const neckX0 = xJoinA, neckX1 = xB - RB * Math.sqrt(Math.max(0, 1 - (neckR / RB) ** 2));
  const nArch = Math.max(3, Math.round((neckX1 - neckX0) / 0.7));
  for (let i = 0; i <= nArch; i++) {
    const rx = neckX0 + (i / nArch) * (neckX1 - neckX0);
    // a FULL closed hoop band around the corridor section (lower half buries) — no open ends
    const arch = dec(new THREE.Mesh(new THREE.TorusGeometry(neckR + 0.02, 0.06, 6, 22), _hullDarkMat));
    arch.quaternion.copy(qY(Math.PI / 2)); arch.position.set(rx, AXIS_Y, 0); g.add(arch);
  }
  for (const jx of [neckX0, neckX1]) {   // a full collar ring in the Y-Z section plane
    const collar = dec(new THREE.Mesh(new THREE.TorusGeometry(neckR + 0.05, 0.11, 8, 20), _rustMat));
    collar.quaternion.copy(qY(Math.PI / 2)); collar.position.set(jx, AXIS_Y, 0); g.add(collar);
  }

  // ── external AIRLOCK / utility module (solid, collided) on the −Z flank of dome A (clear of
  //    the +Z doorways) — carries the salvage panel. ──
  const alW = 1.5, alH = 1.7, alD = 1.1;
  const alRg = Math.sqrt(Math.max(0.04, RA * RA - AXIS_Y * AXIS_Y));   // dome-A ground half-width
  const alX = xA + (phash(seed, 12) - 0.5) * RA * 0.5;
  const alZ = -(alRg * 0.82 + alD / 2);        // seated against the −Z flank
  const al = new THREE.Mesh(new THREE.BoxGeometry(alW, alH, alD), _hullMat);
  al.position.set(alX, alH / 2, alZ); g.add(al);
  colliders.push({ kind: 'box', half: { x: alW / 2, y: alH / 2, z: alD / 2 }, pos: { x: alX, y: alH / 2, z: alZ } });
  const hatch = dec(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16), _hullDarkMat));
  hatch.rotation.x = Math.PI / 2; hatch.position.set(alX, alH * 0.5, alZ - alD / 2 - 0.02); g.add(hatch);
  const hatchRing = dec(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 18), _rustMat));
  hatchRing.position.set(alX, alH * 0.5, alZ - alD / 2 - 0.06); g.add(hatchRing);
  const alRoof = dec(new THREE.Mesh(new THREE.BoxGeometry(alW + 0.1, 0.14, alD + 0.1), _hullDarkMat));
  alRoof.position.set(alX, alH + 0.06, alZ); g.add(alRoof);

  // a bent dead comms antenna on the big dome's crown (a silent-outpost read; thick primitives)
  const antBaseY = AXIS_Y + RA - 0.12;
  const ant = dec(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1.7, 6), _hullDarkMat));
  ant.position.set(xA + 0.1, antBaseY + 0.8, 0.1); ant.rotation.z = 0.22; g.add(ant);
  const antTipY = antBaseY + 0.8 + Math.cos(0.22) * 0.85;
  const antTipX = xA + 0.1 + Math.sin(0.22) * 0.85;
  const yagi = dec(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), _rustMat));
  yagi.rotation.x = Math.PI / 2; yagi.position.set(antTipX, antTipY - 0.2, 0.1); g.add(yagi);
  const nub = dec(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), _rustMat)); nub.position.set(antTipX, antTipY, 0.1); g.add(nub);

  // ── COLLISION (rule 9): TILE box colliders co-located with the visible shell surface — one
  //    tangent box per coarse (station × ring) patch of the INNER wall, over the whole above-
  //    ground shell EXCEPT the doorway holes. Because a collider sits right at every visible
  //    wall (near AND far, incl. the ±X pole caps + the neck bore walls), no exterior ray can
  //    find a visible wall without collision, yet the doorways + the dome→neck→dome bore stay
  //    clear (their cells are the actual mesh holes). Player stops at the visible interior wall. ──
  const WALL_H = 2.15;                            // walk-height wall band for the pole caps
  const CI = 4, CK = 2;                          // collider grid coarsening (stations, rings)
  const rSlope = (x: number) => (rAt(x + 0.05) - rAt(x - 0.05)) / 0.1;
  // The door's x-window taken from the ACTUAL mesh hole (rule 9: collision matches the model),
  // so a trimmed box abuts the jamb exactly — wall covered right up to the opening, nothing
  // protruding into it.
  const doorWin = doorRims.map((rm) => (rm.i1 < rm.i0 ? null : { x0: xs[rm.i0], x1: xs[rm.i1] }));
  const inDoorBand = (k: number) => ((k + nS - DOOR_K0) % nS) < (DOOR_K1 - DOOR_K0 + 1);
  const _tx = new THREE.Vector3(), _ta = new THREE.Vector3(), _nn = new THREE.Vector3();
  const _mtx = new THREE.Matrix4();
  for (let i = CI; i <= M - CI; i += CI) {
    const x = xs[i], r = rAt(x), ri = Math.max(0.05, r - WALL_T), rp = rSlope(x);
    const dxSpan = (xs[Math.min(M, i + CI)] - xs[Math.max(0, i - CI)]) / 2;
    for (let k = 0; k < nS; k += CK) {
      const a = (k / nS) * Math.PI * 2;
      const py = AXIS_Y + ri * Math.cos(a);
      if (py < 0.25) continue;                    // buried patch — skip (bottom is under the sand)
      // Doorway: TRIM this box's x EXTENT out of the door window rather than testing its
      // CENTRE. `dxSpan` is the full station spacing but is used as a HALF-extent, so each box
      // is ~2.9m wide while stations sit 1.31m apart. A centre-distance skip therefore kept the
      // boxes flanking the door, and their bodies still reached into the opening — leaving only
      // ~1.0m clear against a 1.4m player sphere. That WAS the hab_dome seal (walkin 0/16): the
      // mesh hole was right and only the collision intruded, which is why every mesh-topology
      // check passed while the interior was unreachable.
      let lo = x - dxSpan * 1.12, hi = x + dxSpan * 1.12, dropped = false;
      if (inDoorBand(k)) {
        for (const w of doorWin) {
          if (!w || hi <= w.x0 || lo >= w.x1) continue;          // no overlap with this door
          if (lo >= w.x0 && hi <= w.x1) { dropped = true; break; }  // wholly inside the hole
          if (w.x0 - lo >= hi - w.x1) hi = w.x0; else lo = w.x1;  // keep the larger surviving side
        }
      }
      if (dropped || hi - lo < 0.06) continue;
      const xc = (lo + hi) / 2;
      const pz = ri * Math.sin(a);
      // orthonormal tangent frame: along-X, along-ring, outward normal
      _tx.set(1, rp * Math.cos(a), rp * Math.sin(a)).normalize();
      _ta.set(0, -Math.sin(a), Math.cos(a));       // ∂/∂α (already unit)
      _nn.copy(_tx).cross(_ta).normalize();
      _ta.copy(_nn).cross(_tx).normalize();        // re-orthogonalize
      _mtx.makeBasis(_tx, _ta, _nn);
      const q = new THREE.Quaternion().setFromRotationMatrix(_mtx);
      const arc = ri * (CK / nS) * Math.PI * 2;
      colliders.push({ kind: 'box', half: { x: (hi - lo) / 2, y: arc * 0.62, z: 0.2 },
        pos: { x: xc, y: py, z: pz }, quat: { x: q.x, y: q.y, z: q.z, w: q.w } });
    }
  }
  // pole-tip caps — the first/last CI station bands are too small to tile; a solid box fills
  // each tip cross-section so a low axial ray can't slip through the untiled cone.
  for (const dir of [1, -1] as const) {
    const px0 = dir === 1 ? xPole0 : xPole1;
    const ex = px0 + dir * (CI * ((xPole1 - xPole0) / M)) * 0.6;
    const rc = Math.max(0.3, rAt(ex) - WALL_T + 0.1);
    const capH = Math.min(WALL_H, AXIS_Y + rc);
    colliders.push({ kind: 'box', half: { x: Math.abs(ex - px0) + 0.15, y: capH / 2, z: rc },
      pos: { x: (px0 + ex) / 2, y: capH / 2, z: 0 } });
  }

  // ── walk-probe (verify:solid checks 5/6): component-LOCAL waypoints down the whole run
  //    (outside dome-A door → dome A → neck → dome B), transformed to world by the harness. ──
  const doorZOut = Math.sqrt(Math.max(0.04, RA * RA - AXIS_Y * AXIS_Y)) + 1.8;
  g.userData.habDomeProbeLocal = {
    floorHandles: [],
    waypoints: [
      { name: 'outside', x: xA, y: 0.1, z: doorZOut },
      { name: 'mouth', x: xA, y: 0.1, z: Math.sqrt(Math.max(0.04, RA * RA - AXIS_Y * AXIS_Y)) - 0.3 },
      { name: 'hold', x: xA, y: 0.1, z: RA * 0.35 },
      { name: 'mid', x: (xJoinA + neckX1) / 2, y: 0.1, z: 0 },
      { name: 'domeB', x: xB, y: 0.1, z: 0 },
      { name: 'domeBhold', x: xB, y: 0.1, z: RB * 0.3 },
    ],
  };

  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(alX, alH * 0.5, alZ - alD / 2), quat: FACE.negZ(), kind: 'escape_pod' as PanelKind },
  ];
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posY(), radius: RA, tag: 'base' }];
  g.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(g);
  bbox.min.y = 0;   // built from the ground plane up → liftToGround stays a no-op
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

// ════════════════════════════════════════════════════════════════════
// TRANSIT CAR (M9 archetype 3, campaign Sharpen&Deepen) — a half-buried transit / cargo
// RAIL car, tilted + settled on a buried BOGIE (rail truck with paired flanged wheels),
// coupled to a shorter jackknifed second car (a derailed 2-segment train sinking into the
// sand). The one RAIL/TRANSIT silhouette the POI set lacked — distinct from cargo_crawler
// (a TRACKED hauler): rail tells are the bogie + paired FLANGED wheels, a knuckle COUPLER at
// each end, a passenger WINDOW STRIP + a big sliding CARGO DOOR (the salvage face), roof RIBS
// + vents, and an end LADDER + grab rails. warm bucket (weathered painted rail steel).
//
// THICKNESS (rule 7): each car body is a solid thick box; doors/windows/ribs/vents get real
// depth (≥12cm). COLLISION (rule 9): each car BODY is one solid box collider (a rail car is a
// mass you walk around/on — the crawler box precedent, NOT a hollow shell) + each bogie is a
// box collider spanning its wheels; wheels/couplers/ladders/ribs/doors are decoration (surface
// detail flush on / under the collided masses). Determinism: phash only (one seedOf upstream).
// ════════════════════════════════════════════════════════════════════
export function transitCar(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const dec = (m: THREE.Mesh) => { m.userData.isWreckDecoration = true; return m; };

  // Push a box collider expressed in a car-subgroup frame (local pos, then the subgroup's
  // yaw+offset) into the component-root frame — so a jackknifed car's collider stays matched.
  const pushBox = (half: { x: number; y: number; z: number }, lp: THREE.Vector3, sgPos: THREE.Vector3, sgQuat: THREE.Quaternion) => {
    const p = lp.clone().applyQuaternion(sgQuat).add(sgPos);
    colliders.push({ kind: 'box', half, pos: { x: p.x, y: p.y, z: p.z }, quat: { x: sgQuat.x, y: sgQuat.y, z: sgQuat.z, w: sgQuat.w } });
  };

  // ── Build one rail car into a subgroup (local X = long axis; wheels rest at y=0) ──
  // Returns the local X of the two end faces so the caller can hang couplers / mate a 2nd car.
  const buildCar = (
    sgPos: THREE.Vector3, sgQuat: THREE.Quaternion,
    o: { len: number; w: number; h: number; sk: number; door: boolean; nBogie: number },
  ) => {
    const sg = new THREE.Group();
    sg.position.copy(sgPos); sg.quaternion.copy(sgQuat); g.add(sg);
    const { len, w, h, sk } = o;
    const add = (m: THREE.Mesh) => { sg.add(m); return m; };

    const wheelR = 0.5;
    const axleY = wheelR;                     // wheel centre (bottom of wheel at y=0)
    const floorY = 1.5;                       // underside of the car body — RAISED so the truck+wheels show in a clear bogie gap
    const underH = 0.3;                       // underframe sill beam depth
    const roofY = floorY + h;

    // ── car BODY (solid, structural — the one big box collider covers body + underframe) ──
    const body = add(new THREE.Mesh(new THREE.BoxGeometry(len, h, w), _hullMat));
    body.position.set(0, floorY + h / 2, 0);
    const colCtrY = ((floorY - underH) + roofY) / 2;
    pushBox({ x: len / 2, y: (roofY - (floorY - underH)) / 2, z: w / 2 }, new THREE.Vector3(0, colCtrY, 0), sgPos, sgQuat);

    // underframe sill beam (decoration — covered by the body collider's downward extent)
    const sill = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, underH, w * 0.74), _hullDarkMat)));
    sill.position.set(0, floorY - underH / 2, 0);
    for (const sz of [-1, 1]) {   // solebar side beams (the classic rail underframe channel)
      const sole = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, underH * 0.7, 0.14), _rustMat)));
      sole.position.set(0, floorY - underH * 0.45, sz * w * 0.42);
    }

    // ── BOGIES (rail trucks) — the money rail tell: paired FLANGED wheels on a side-framed truck ─
    const bogieLen = 1.9;
    const bogieXs: number[] = [];
    for (let b = 0; b < o.nBogie; b++) {
      const bx = o.nBogie === 1 ? 0 : -len * 0.31 + b * (len * 0.62);
      bogieXs.push(bx);
      // bogie box collider spanning the wheelbase + track height (wheels/frames sit inside it)
      pushBox({ x: bogieLen / 2 + 0.2, y: axleY + 0.08, z: w / 2 - 0.06 },
        new THREE.Vector3(bx, axleY + 0.08, 0), sgPos, sgQuat);
      // truck side FRAMES (the visible cast-steel bogie side, just inside the body flank) + a
      // transom + a bolster across — a chunky truck sitting in the exposed bogie gap.
      for (const sz of [-1, 1]) {
        const frame = add(dec(new THREE.Mesh(new THREE.BoxGeometry(bogieLen, 0.44, 0.2), _hullDarkMat)));
        frame.position.set(bx, axleY + 0.14, sz * (w / 2 - 0.14));
      }
      const bolster = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, w * 0.78), _hullDarkMat)));
      bolster.position.set(bx, axleY + 0.34, 0);
      const centre = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.34, floorY - axleY - 0.2, 0.34), _rustMat)));
      centre.position.set(bx, (axleY + 0.5 + floorY) / 2, 0);   // king-pin post up to the sill
      // 2 axles × 2 flanged wheels (pushed OUTBOARD to sit just inside the body flank → visible)
      for (const ax of [bx - bogieLen * 0.3, bx + bogieLen * 0.3]) {
        const axle = add(dec(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, w * 0.72, 8), _rustMat)));
        axle.rotation.x = Math.PI / 2; axle.position.set(ax, axleY, 0);
        for (const sz of [-1, 1]) {
          const zc = sz * (w / 2 - 0.11);
          // a SOLID rust disc (catches the low sun) with a slim dark flange rib at the inner edge
          // + a dark hub cap — reads as a clean rail wheel, not concentric rings.
          const wheel = add(dec(new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.18, 22), _rustMat)));
          wheel.rotation.x = Math.PI / 2; wheel.position.set(ax, axleY, zc);
          const flange = add(dec(new THREE.Mesh(new THREE.CylinderGeometry(wheelR + 0.06, wheelR + 0.06, 0.06, 22), _hullDarkMat)));
          flange.rotation.x = Math.PI / 2; flange.position.set(ax, axleY, zc - sz * 0.09);   // flange on the INNER (rail-guiding) face
          const hub = add(dec(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 10), _hullDarkMat)));
          hub.rotation.x = Math.PI / 2; hub.position.set(ax, axleY, zc + sz * 0.06);
        }
      }
    }

    // ── end sills + knuckle COUPLERS + a buffer plate at each end (rail tell) ──
    for (const sx of [-1, 1]) {
      const ex = sx * len / 2;
      const endSill = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, w * 0.92), _hullDarkMat)));
      endSill.position.set(ex + sx * 0.08, floorY - 0.06, 0);
      const shank = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.24, 0.24), _rustMat)));
      shank.position.set(ex + sx * 0.45, floorY - 0.12, 0);
      const knuckle = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.34), _hullDarkMat)));
      knuckle.position.set(ex + sx * 0.82, floorY - 0.12, 0);
      // end diaphragm / door recess (transit gangway read)
      const endDoor = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.14, h * 0.66, w * 0.42), _hullDarkMat)));
      endDoor.position.set(ex + sx * (w > 0 ? 0.01 : 0.01), floorY + h * 0.42, 0);
    }

    // ── passenger WINDOW STRIP (upper band, both long sides) — recessed dark glazing + mullions ─
    for (const sz of [-1, 1]) {
      const bandZ = sz * (w / 2 + 0.02);
      const winY = floorY + h * 0.64;
      const winH = h * 0.26;
      const band = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.72, winH, 0.13), _hullDarkMat)));
      band.position.set(0, winY, bandZ);
      // sill + header rails framing the strip (real depth)
      for (const dy of [-winH / 2 - 0.05, winH / 2 + 0.05]) {
        const rail = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.74, 0.1, 0.16), _hullMat)));
        rail.position.set(0, winY + dy, bandZ);
      }
      // window mullions (pillars between panes)
      const nWin = 7;
      for (let i = 0; i <= nWin; i++) {
        const mx = -len * 0.36 + (i / nWin) * len * 0.72;
        const mull = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.12, winH + 0.02, 0.16), _hullMat)));
        mull.position.set(mx, winY, bandZ);
      }
    }

    // ── lower-body corrugation ribs (freight-car flank) + vertical plate seams (both sides) ──
    for (const sz of [-1, 1]) {
      const flankZ = sz * (w / 2 + 0.015);
      const nRib = 10;
      for (let i = 0; i < nRib; i++) {
        const rx = -len * 0.44 + (i / (nRib - 1)) * len * 0.88;
        const rib = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.34, 0.12), _rustMat)));
        rib.position.set(rx, floorY + h * 0.24, flankZ);
      }
    }

    // ── sliding CARGO DOOR on +Z (the salvage face) — a recessed track + a thick door leaf ──
    let doorLocal: THREE.Vector3 | null = null;
    if (o.door) {
      const doorW = 2.1, doorH = h * 0.66, doorY = floorY + h * 0.4, doorZ = w / 2 + 0.1;
      const doorX = len * 0.05;
      // recessed dark door pocket (the opening) → the sliding leaf reads as a real door, not a decal
      const pocket = add(dec(new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.5, doorH + 0.24, 0.1), _hullDarkMat)));
      pocket.position.set(doorX, doorY, w / 2 + 0.005);
      for (const dy of [doorH / 2 + 0.16, -doorH / 2 - 0.14]) {   // upper + lower slide track (bold)
        const track = add(dec(new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.55, 0.16, 0.2), _hullMat)));
        track.position.set(doorX, doorY + dy, w / 2 + 0.06);
      }
      const leaf = add(dec(new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.2), _rustMat)));
      leaf.position.set(doorX, doorY, doorZ);
      // door stiffeners (vertical Z-bars) + a bold latch bar + a grab handle
      for (const hx of [-doorW * 0.32, -doorW * 0.05, doorW * 0.22]) {
        const stiff = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH * 0.92, 0.12), _hullDarkMat)));
        stiff.position.set(doorX + hx, doorY, doorZ + 0.07);
      }
      const latch = add(dec(new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.9, 0.14, 0.14), _hullDarkMat)));
      latch.position.set(doorX, doorY - doorH * 0.12, doorZ + 0.08);
      const handle = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.12), _hullDarkMat)));
      handle.position.set(doorX + doorW * 0.44, doorY, doorZ + 0.1);
      doorLocal = new THREE.Vector3(doorX, doorY, doorZ + 0.1);
    }

    // ── ROOF — a shallow cap + transverse ribs + 2 ventilators + a running board ──
    const cap = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.99, 0.18, w * 0.96), _hullMat)));
    cap.position.set(0, roofY + 0.07, 0);
    const nRoofRib = 7;
    for (let i = 0; i < nRoofRib; i++) {
      const rx = -len * 0.43 + (i / (nRoofRib - 1)) * len * 0.86;
      const rib = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, w * 0.98), _hullDarkMat)));
      rib.position.set(rx, roofY + 0.16, 0);
    }
    for (const vx of [-len * 0.22, len * 0.22]) {   // roof ventilators (torpedo vents)
      const vent = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.7), _rustMat)));
      vent.position.set(vx, roofY + 0.31, 0);
      const cowl = add(dec(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 10), _hullDarkMat)));
      cowl.position.set(vx, roofY + 0.55, 0);
    }
    const runBoard = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.9, 0.06, 0.42), _hullDarkMat)));
    runBoard.position.set(0, roofY + 0.18, 0);

    // ── end LADDER + grab rails (rooftop access — a strong human-scale rail cue) on the +X end ──
    const ladX = len / 2 + 0.02;
    for (const sz of [-0.34, 0.34]) {
      const rail = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.07, h * 0.86, 0.07), _hullDarkMat)));
      rail.position.set(ladX, floorY + h * 0.42, sz);
    }
    for (let y = floorY * 0.4; y < floorY + h * 0.82; y += 0.42) {
      const rung = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.72), _rustMat)));
      rung.position.set(ladX, y, 0);
    }
    // corner grab handles by the door + the far end
    for (const [gx, gz] of [[len * 0.06 - 1.2, w / 2 + 0.12], [-len / 2 + 0.3, w / 2 + 0.12]] as const) {
      const grab = add(dec(new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.5, 0.08), _rustMat)));
      grab.position.set(gx, floorY + h * 0.35, gz);
    }

    // reporting marks placeholder plate (a dark stencil box, low on the flank) — human read
    const plate = add(dec(new THREE.Mesh(new THREE.BoxGeometry(len * 0.16, h * 0.14, 0.06), _hullDarkMat)));
    plate.position.set(-len * 0.28, floorY + h * 0.2, w / 2 + 0.04);

    return { floorY, roofY, doorLocal, sk };
  };

  // ── MAIN car ──
  const len = 8.6 + phash(seed, 1) * 3.0;      // 8.6–11.6m
  const w = 2.5 + phash(seed, 2) * 0.28;
  const h = 2.4 + phash(seed, 3) * 0.4;
  const main = buildCar(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), { len, w, h, sk: seed, door: true, nBogie: 2 });

  // ── coupled SECOND car — shorter, jackknifed off the −X coupler + sunk deeper (derailed) ──
  const len2 = 4.6 + phash(seed, 10) * 1.6;
  const w2 = w * 0.96, h2 = h * 0.9;
  const yawSign = phash(seed, 11) < 0.5 ? 1 : -1;
  const yaw = yawSign * (0.1 + phash(seed, 12) * 0.1);    // gentle jackknife (a trailing car, not overlapping)
  const q2 = qY(yaw);
  const sink2 = 0.55 + phash(seed, 13) * 0.25;           // sinks deeper into the sand (derailed/half-buried)
  // couple the 2nd car's +X end a clear gap behind the main −X coupler point, then swing about it
  const pivot = new THREE.Vector3(-len / 2 - 1.1, -sink2, 0);
  const frontLocal = new THREE.Vector3(len2 / 2, 0, 0).applyQuaternion(q2);
  const sgPos2 = pivot.clone().sub(frontLocal);
  buildCar(sgPos2, q2, { len: len2, w: w2, h: h2, sk: seed + 500, door: false, nBogie: 1 });

  const panelMounts: PanelMount[] = main.doorLocal
    ? [{ pos: main.doorLocal, quat: FACE.posZ(), kind: 'cargo_container' as PanelKind }]
    : [];
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posY(), radius: w, tag: 'base' }];
  g.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(g);
  bbox.min.y = 0;   // built from the ground plane up → liftToGround stays a no-op
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

export const _IDENT_MAT = new THREE.Matrix4();   // root placement
