// Mega-wreck POI — a sleek ~120m crashed DAGGER warship (ACAJ from-scratch
// rebuild, per docs/research/megawreck-concept.md). Narrow blade (~5:1), snapped
// in two at an amidships fracture, driven nose-first into a dune — entered through
// a bow hull breach and walked via a single spinal corridor through 6 chambers to
// the elevated bridge payoff.
//
// Architecture:
//   • INTERIOR = a list of `Cell` descriptors (corridor segments + rooms), each
//     expanded by `cellWallBoxes()` into axis-aligned boxes. BOTH the visual walls
//     (makeMegaWreck) and the cuboid colliders (placeMegaWreck) consume the SAME
//     descriptors, so geometry + collision never drift. Built LEVEL at y≈0.
//   • EXTERIOR = the `shell` group — a lofted faceted dagger hull (two masses +
//     fracture cross-section + command island + engines + breaches + plating),
//     ALL FrontSide + noCollider, TILTED into a list + sunk into the dune. The
//     hull generously ENVELOPS the level interior boxes so none poke through.
//
// Local space: +Z = aft/engine end, -Z = bow tip; y=0 = walkable floor; walls
// bury WALL_BURY below. Hull long-axis = Z (~123m: local Z -47..+76).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { addAccessPanel, placeDebrisField, makeEngineBellMesh } from './wrecks.ts';
import { makeLoftedHull, makeFormerRings, makeBreach, tagWreckDecoration, makeCable, makeSandMound } from './wreckForms.ts';
import { addShelterZone, type ShelterRegistry } from '../shelter/shelterZones.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';
import { placeJournal, type Journal } from './journal.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { createPaintedMetalMaterial } from './paintMaterial.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Shared materials (ABH procedural shader vocabulary).
const _hullMat = createRustedHullMaterial({ baseColor: Tuning.WRECK_HULL_HEX, streakIntensity: 0.55 });
const _hullDarkMat = createRustedHullMaterial({ baseColor: Tuning.WRECK_HULL_DARK_HEX, streakIntensity: 0.40 });
const _rustMat = createPaintedMetalMaterial(Tuning.WRECK_RUST_HEX, { wearLevel: 0.65 });
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({ color: Tuning.WRECK_NOZZLE_INTERIOR_HEX });
const _antennaMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, { wornScale: 6.0, scratchStrength: 0.04 });
const _pipeMat = createMetalMaterial(0x3a3028, { wornScale: 5.0, scratchStrength: 0.04 });
const _viewportMat = new THREE.MeshBasicMaterial({ color: 0x14181c });
void _rustMat;

// ── Burial + wall thickness.
const WALL_BURY = 6.0;
const WALL_THICK = 0.4;
const SLAB_T = 0.2;          // floor/ceiling half-thickness

// ── Exterior dagger masses (lofted). Bow mass -60..-5, aft mass +18..+76.
const FRACTURE_Z = 6;        // fracture center
const BOW_FACE_Z = -5;       // bow hull torn face
const AFT_FACE_Z = 18;       // aft hull torn face
const ISLAND_Z = 68;         // command island Z (over the bridge)
const TRANSOM_Z = 76;        // engine transom

// ── Engine bells (narrow ship → smaller bells).
const BELL_R = 3.2;
const BELL_DX = 4.2;

// ── Interior cell model ────────────────────────────────────────────────
// A walkable box (corridor segment or room). Consecutive cells share OPEN Z
// faces (no wall between) → one connected interior. Side openings (the bow
// breach entrance, the shelter spur) cut a gap in an X wall.
interface Cell {
  id: string;
  cx: number;            // X center (kinks the spine)
  hw: number;            // half-width (X)
  z0: number; z1: number;
  floorY: number;
  ceilY: number | null;  // null = open sky (no ceiling — the fracture)
  openZ0: boolean; openZ1: boolean;
  gapMinX?: [number, number]; // Z-range of an opening in the -X wall
  gapMaxX?: [number, number]; // Z-range of an opening in the +X wall
  mat?: THREE.Material;
}

// The interior layout (bow → aft). All floors y=0 except the bridge (raised +3).
const SPINE_HW = 1.75;       // 3.5m corridor
const CELLS: Cell[] = [
  { id: 'R1', cx: 0,    hw: 4.0,  z0: -47, z1: -37, floorY: 0, ceilY: 4.0, openZ0: false, openZ1: true,  gapMinX: [-44, -39] }, // entrance breach hall
  { id: 'C1', cx: 1.2,  hw: SPINE_HW, z0: -37, z1: -27, floorY: 0, ceilY: 3.0, openZ0: true, openZ1: true },
  { id: 'R2', cx: 2.6,  hw: 3.5,  z0: -27, z1: -17, floorY: 0, ceilY: 3.2, openZ0: true, openZ1: true },  // crew / med bay
  { id: 'C2', cx: 0.6,  hw: SPINE_HW, z0: -17, z1: -5, floorY: 0, ceilY: 3.0, openZ0: true, openZ1: true },
  { id: 'R3', cx: 0,    hw: 5.0,  z0: -5,  z1: 17,  floorY: 0, ceilY: null, openZ0: true, openZ1: true }, // fracture crossing (open sky)
  { id: 'C3', cx: -1.2, hw: SPINE_HW, z0: 17,  z1: 27,  floorY: 0, ceilY: 3.0, openZ0: true, openZ1: true },
  { id: 'R4', cx: 0,    hw: 5.0,  z0: 27,  z1: 44,  floorY: 0, ceilY: 6.0, openZ0: true, openZ1: true },  // engine / reactor room
  { id: 'C4', cx: 1.2,  hw: SPINE_HW, z0: 44,  z1: 50,  floorY: 0, ceilY: 3.0, openZ0: true, openZ1: true },
  { id: 'R5', cx: 0,    hw: 4.5,  z0: 50,  z1: 62,  floorY: 0, ceilY: 4.0, openZ0: true, openZ1: true, gapMaxX: [53, 58] }, // cargo / mess junction
  { id: 'SH', cx: 7.0,  hw: 2.5,  z0: 52.5, z1: 58.5, floorY: 0, ceilY: 3.0, openZ0: false, openZ1: false, gapMinX: [53, 58] }, // shelter pocket
  { id: 'C5', cx: 0,    hw: SPINE_HW, z0: 62,  z1: 66,  floorY: 0, ceilY: 3.0, openZ0: true, openZ1: true },
  { id: 'R6', cx: 2.0,  hw: 4.5,  z0: 66,  z1: 76,  floorY: 3, ceilY: 7.0, openZ0: true, openZ1: false }, // bridge (raised payoff)
];

interface WallBox { x: number; y: number; z: number; hx: number; hy: number; hz: number; }

// Expand a cell into its floor + ceiling + 4 walls (split around side openings,
// skipping connected Z faces). Used by BOTH the mesh + the collider builders.
function cellWallBoxes(c: Cell): WallBox[] {
  const out: WallBox[] = [];
  const midZ = (c.z0 + c.z1) / 2, lenH = (c.z1 - c.z0) / 2;
  const top = c.ceilY ?? c.floorY + 5;          // open-sky cells: short stub walls
  const wallBot = c.floorY - WALL_BURY;
  const wallCy = (wallBot + top) / 2, wallH = top - wallBot;
  const GAP_H = 3.4;                              // doorway / breach opening height
  // Floor.
  out.push({ x: c.cx, y: c.floorY - SLAB_T, z: midZ, hx: c.hw + WALL_THICK, hy: SLAB_T, hz: lenH });
  // Ceiling.
  if (c.ceilY != null) out.push({ x: c.cx, y: c.ceilY + SLAB_T, z: midZ, hx: c.hw + WALL_THICK, hy: SLAB_T, hz: lenH });
  // X walls, split around an optional opening.
  for (const sign of [-1, 1] as const) {
    const wx = c.cx + sign * (c.hw + WALL_THICK / 2);
    const gap = sign < 0 ? c.gapMinX : c.gapMaxX;
    if (!gap) { out.push({ x: wx, y: wallCy, z: midZ, hx: WALL_THICK / 2, hy: wallH / 2, hz: lenH }); continue; }
    const [ga, gb] = gap;
    if (ga > c.z0) out.push({ x: wx, y: wallCy, z: (c.z0 + ga) / 2, hx: WALL_THICK / 2, hy: wallH / 2, hz: (ga - c.z0) / 2 });
    if (c.z1 > gb) out.push({ x: wx, y: wallCy, z: (gb + c.z1) / 2, hx: WALL_THICK / 2, hy: wallH / 2, hz: (c.z1 - gb) / 2 });
    const bH = c.floorY - wallBot;                // below opening (buried band)
    if (bH > 0.05) out.push({ x: wx, y: (wallBot + c.floorY) / 2, z: (ga + gb) / 2, hx: WALL_THICK / 2, hy: bH / 2, hz: (gb - ga) / 2 });
    const aH = top - (c.floorY + GAP_H);          // above opening (lintel)
    if (aH > 0.05) out.push({ x: wx, y: (c.floorY + GAP_H + top) / 2, z: (ga + gb) / 2, hx: WALL_THICK / 2, hy: aH / 2, hz: (gb - ga) / 2 });
  }
  // Z end walls (only on closed faces).
  if (!c.openZ0) out.push({ x: c.cx, y: wallCy, z: c.z0 - WALL_THICK / 2, hx: c.hw + WALL_THICK, hy: wallH / 2, hz: WALL_THICK / 2 });
  if (!c.openZ1) out.push({ x: c.cx, y: wallCy, z: c.z1 + WALL_THICK / 2, hx: c.hw + WALL_THICK, hy: wallH / 2, hz: WALL_THICK / 2 });
  return out;
}

// Bridge stair (C5 floor 0 → R6 floor +3) as 3 step cuboids + ramps for the
// fracture crossing. Each is a level cuboid (no rotation) for robust walking.
interface StepBox { x: number; y: number; z: number; hx: number; hy: number; hz: number; }
function interiorSteps(): StepBox[] {
  const steps: StepBox[] = [];
  for (let i = 0; i < 3; i++) {
    const topY = (i + 1) * 1.0;                   // 1,2,3
    steps.push({ x: 1.0, y: topY / 2, z: 64.0 + i, hx: SPINE_HW, hy: topY / 2, hz: 0.6 });
  }
  return steps;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
}

/** Build the mega-wreck meshes (interior walls + exterior dagger shell). */
export function makeMegaWreck(rand: Rng): THREE.Group {
  const _rand = rand;
  const g = new THREE.Group();
  const dark = _hullDarkMat;

  // ── INTERIOR — walls from the shared cell descriptors (level, collidable read).
  for (const c of CELLS) {
    for (const b of cellWallBoxes(c)) {
      const m = box(b.hx * 2, b.hy * 2, b.hz * 2, c.mat ?? dark);
      m.position.set(b.x, b.y, b.z);
      g.add(m);
    }
  }
  // Bridge stair (visual).
  for (const s of interiorSteps()) {
    const m = box(s.hx * 2, s.hy * 2, s.hz * 2, dark);
    m.position.set(s.x, s.y, s.z); g.add(m);
  }
  // Fracture-crossing fallen-bulkhead ramp (visual; the R3 floor carries the player).
  {
    const ramp = box(4, 0.3, 14, dark);
    ramp.position.set(0, 1.4, 6); ramp.rotation.x = 0.18; g.add(ramp);
  }

  // ════════════════════════════════════════════════════════════════════
  // EXTERIOR — the dagger shell (tilted + sunk; FrontSide + noCollider).
  // ════════════════════════════════════════════════════════════════════
  const shell = new THREE.Group();
  shell.name = 'shell';
  const add = (m: THREE.Object3D) => { m.userData.noCollider = true; shell.add(m); };

  // (A1) Bow mass — a sharp tapered wedge driving nose-first into the dune.
  add(makeLoftedHull([
    { z: -60, halfW: 1.3, halfH: 1.8, cy: 1.0 },     // crushed buried tip
    { z: -50, halfW: 4.8, halfH: 5.0, cy: 4.0 },
    { z: -32, halfW: 9.2, halfH: 8.2, cy: 6.0 },
    { z: -16, halfW: 11.0, halfH: 9.0, cy: 6.5 },
    { z: BOW_FACE_Z, halfW: 11.0, halfH: 9.0, cy: 7.0 },   // fracture face
  ], _hullMat));

  // (A2) Aft mass — widest amidships, raking down to a blunt low transom.
  add(makeLoftedHull([
    { z: AFT_FACE_Z, halfW: 11.0, halfH: 9.0, cy: 7.5 },   // fracture face (rides higher)
    { z: 36, halfW: 13.0, halfH: 11.0, cy: 8.5 },          // amidships peak
    { z: 56, halfW: 12.5, halfH: 10.0, cy: 7.5 },
    { z: ISLAND_Z, halfW: 11.0, halfH: 9.0, cy: 7.0 },
    { z: TRANSOM_Z, halfW: 9.5, halfH: 7.0, cy: 5.5 },     // blunt transom
  ], _hullMat));

  // (A3) Mid-hull FRACTURE cross-section — the money shot. Cut-open guts in the
  // ~23m gap: backboard + former rings + countable staggered deck slabs + bent
  // spine stub + dangling cables + torn rim flaps. Aft mass rides ~2m higher.
  {
    const cy = 7.5;
    for (const z of [AFT_FACE_Z + 0.3, BOW_FACE_Z - 0.3]) {
      const back = box(20, 20, 0.4, _viewportMat); back.position.set(0, cy, z); add(back);
    }
    const af = makeFormerRings(11, 3, 1.5, { tube: 0.55 });
    af.rotation.y = -Math.PI / 2; af.position.set(0, cy + 0.5, AFT_FACE_Z); af.scale.set(1, 0.8, 1); add(af);
    const bf = makeFormerRings(10.5, 3, 1.5, { tube: 0.55 });
    bf.rotation.y = -Math.PI / 2; bf.position.set(0, cy - 0.5, BOW_FACE_Z - 3); bf.scale.set(1, 0.8, 1); add(bf);
    const mkDeck = (y: number, z: number, w: number) => { const s = box(w * 2, 0.3, 3.4, dark); s.position.set(0, y, z); add(s); };
    for (const y of [3.0, 6.0, 9.0, 12.0]) mkDeck(y + 1, AFT_FACE_Z + 1.8, 9.5);   // aft decks
    for (const y of [4.5, 7.5, 10.5]) mkDeck(y, BOW_FACE_Z - 1.8, 9.0);            // bow decks (offset Y)
    const seg1 = box(1.3, 1.1, 11, dark); seg1.position.set(-2, 2.0, FRACTURE_Z - 2); seg1.rotation.y = 0.14; add(seg1);
    const seg2 = box(1.1, 1.0, 7, dark); seg2.position.set(1.5, 3.0, FRACTURE_Z + 4); seg2.rotation.set(0.1, -0.2, 0.07); add(seg2);
    for (const [x, z, y] of [[-6, AFT_FACE_Z, 13], [5, BOW_FACE_Z, 11], [-1, FRACTURE_Z, 12], [8, AFT_FACE_Z, 8]] as const)
      add(makeCable(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 3, 0.4, z - 2), 3.0, _pipeMat, 0.1));
    const rim = makeBreach(9, _rand); tagWreckDecoration(rim);
    rim.rotation.x = -Math.PI / 2; rim.position.set(0, cy + 5, AFT_FACE_Z + 0.5); rim.scale.set(1.5, 1, 0.6); add(rim);
  }

  // (A4) Command island — stepped 5-deck wedding-cake on the aft dorsal, offset
  // toward the +X impact flank, with framed viewports + raked windscreen + cap.
  let islandTopY = 16;
  {
    const cz = ISLAND_Z, cx = 3.0, baseY = 15;     // dorsal deck height
    const baseW = 4.0, baseL = 4.5, decks = 5, dh = 2.6;
    let y = baseY;
    for (let i = 0; i < decks; i++) {
      const t = i / decks, w = baseW * (1 - t * 0.45), l = baseL * (1 - t * 0.3);
      const deck = box(w * 2, dh, l * 2, _hullMat); deck.position.set(cx, y + dh / 2, cz + t * 1.4); add(deck);
      const winN = 5, zf = cz + t * 1.4 - l;
      for (let k = 0; k < winN; k++) {
        const wx = cx + (k - (winN - 1) / 2) * (w * 1.5 / winN);
        const fr = box(0.9, 1.1, 0.16, dark); fr.position.set(wx, y + dh * 0.55, zf - 0.08); add(fr);
        const wn = box(0.7, 0.9, 0.34, _viewportMat); wn.position.set(wx, y + dh * 0.55, zf - 0.18); wn.userData.noShadow = true; add(wn);
      }
      y += dh;
    }
    const screen = box(baseW * 1.9, 2.6, 0.4, _viewportMat);
    screen.position.set(cx, baseY + 1.5, cz - baseL - 0.5); screen.rotation.x = -0.4; screen.userData.noShadow = true; add(screen);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(baseW * 0.3, baseW * 0.66, 1.7, 6), _hullMat);
    cap.rotation.y = Math.PI / 6; cap.position.set(cx, y + 0.85, cz); add(cap);
    islandTopY = y + 1.7;
  }

  // (A5) Sensor mast + dish array on the island crown — bent on impact.
  {
    const cz = ISLAND_Z, cx = 3.0;
    const mast = cyl(0.14, 0.34, 10, dark, 7); mast.position.set(cx, islandTopY + 5, cz); mast.rotation.z = 0.1; mast.rotation.x = -0.05; add(mast);
    const crownY = islandTopY + 10, mx = cx + 0.8;
    for (const [r, ox, oy, tilt] of [[1.8, 1.3, -1, 0.4], [2.8, -1.6, 1.5, -0.3], [1.1, 0.6, 3.0, 0.6]] as const) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.5, 12, 1, true), dark);
      d.position.set(mx + ox, crownY + oy, cz + 0.4); d.rotation.x = Math.PI / 2 + tilt; d.rotation.z = ox * 0.1; add(d);
    }
    for (const ox of [-0.8, 0.6, 1.4]) { const whip = cyl(0.03, 0.05, 3.5 + Math.abs(ox), _antennaMat, 4); whip.position.set(mx + ox, crownY + 2, cz - 0.5); whip.rotation.z = ox * 0.12; add(whip); }
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), _hullMat); globe.position.set(mx, crownY + 0.4, cz); add(globe);
  }

  // (A6) Engine bank — 3 clustered flared bells at the transom on an exposed torn
  // mount cage, asymmetric (one skyward, one twisted toward the buried flank).
  {
    const ez = TRANSOM_Z + 1, ey = 6;
    const slots: Array<[number, number, number]> = [[-BELL_DX, ey - 1, 1.0], [0, ey + 1.5, 1.05], [BELL_DX, ey, 0.92]];
    for (const [sx, sy, scl] of slots) {
      const bell = makeEngineBellMesh(BELL_R * scl, BELL_R * 1.1, _hullMat, _nozzleInteriorMat);
      bell.rotation.x = Math.PI / 2; bell.position.set(sx, sy, ez); add(bell);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(BELL_R * scl * 1.05, 0.3, 6, 14), dark);
      ring.rotation.y = Math.PI / 2; ring.position.set(sx, sy, ez - BELL_R * 0.7); add(ring);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.3;
        const strut = box(0.26, 0.26, 3, dark);
        strut.position.set(sx + Math.cos(a) * BELL_R * scl * 0.9, sy + Math.sin(a) * BELL_R * scl * 0.7, ez - 2);
        strut.lookAt(sx, sy, ez - 4); add(strut);
      }
    }
  }

  // (A7) Hull plating — dorsal spine keel + irregular fore-aft flank strakes
  // (dense on the narrow hull → reads as a real plated ship, not a smooth blade).
  {
    const z0 = -52, z1 = TRANSOM_Z - 2, midZ = (z0 + z1) / 2, lenH = (z1 - z0) / 2;
    const spine = box(1.0, 0.5, lenH * 2, _hullMat); spine.position.set(2.5, 15.5, midZ); add(spine);
    for (const side of [-1, 1]) for (const [yf, zoff] of [[3, -2], [6, 1], [9, -1], [11.5, 2]] as const) {
      const st = box(0.16, 0.34, lenH * 1.7, dark); st.position.set(side * 11.5, yf, midZ + zoff); add(st);
    }
  }

  // (A8) Asymmetric impact breaches — +X impact flank shattered (2), -X lee tear (1).
  {
    const breach = (side: number, y: number, z: number, r: number) => {
      const b = makeBreach(r, _rand); tagWreckDecoration(b);
      b.position.set(side * 11.5, y, z); b.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; b.scale.set(1, 0.95, 1.2); add(b);
    };
    breach(1, 11, 30, 3.6); breach(1, 5, 52, 2.4); breach(-1, 10, 40, 1.8);
  }

  // Tilt the shell into a list + sink it. Interior boxes stay LEVEL (D185).
  shell.rotation.z = -0.20;   // ~11.5° roll toward the +X impact flank
  shell.rotation.x = -0.06;   // nose-down pitch
  shell.position.y = -2.5;
  g.add(shell);

  // Shadow flags.
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = !m.userData.noShadow; m.receiveShadow = true; } });
  return g;
}

/**
 * Place the mega-wreck at a world position with yaw + tilt. Single fixed body;
 * cuboid colliders from the shared cell descriptors; registers shelter zone (the
 * pocket), 2 salvage panels (engine room + bridge), the captain's-log journal.
 */
export function placeMegaWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  tilt: THREE.Quaternion,
  rand: Rng,
  shelter: ShelterRegistry,
  salvageables: SalvageableRegistry,
  journals?: { list: Journal[] },
): THREE.Group {
  const group = makeMegaWreck(rand);
  group.name = 'megaWreck';
  group.position.copy(pos);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const finalQ = new THREE.Quaternion().multiplyQuaternions(tilt, yawQ);
  group.quaternion.copy(finalQ);
  scene.add(group);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: finalQ.x, y: finalQ.y, z: finalQ.z, w: finalQ.w }),
  );
  const cuboid = (b: WallBox) => world.createCollider(
    RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z), body,
  );

  // ── Interior colliders from the SAME cell descriptors as the meshes.
  for (const c of CELLS) for (const b of cellWallBoxes(c)) cuboid(b);
  for (const s of interiorSteps()) cuboid(s);

  // ── Helper: a nested salvage panel registered at its world position.
  const worldOf = (local: THREE.Vector3) => local.clone().applyQuaternion(finalQ).add(pos);
  const addPanel = (local: THREE.Vector3, faceYaw: number) => {
    const p = new THREE.Group();
    p.position.copy(local); p.rotation.y = faceYaw;
    addAccessPanel(p, 0, 0, 0, 1, 0, 'massive');
    group.add(p); p.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
    registerSalvageable(salvageables, p, 'massive', wp, rand);
  };
  // Panel #1 — engine/reactor room (R4) back wall (+Z), facing -Z into the room.
  addPanel(new THREE.Vector3(3.5, 0, 43), Math.PI);
  // Panel #2 — bridge (R6) console wall (+X side), facing -X.
  addPanel(new THREE.Vector3(5.5, 3, 71), -Math.PI / 2);

  // ── Shelter zone — covers the secured pocket (SH). AABB sized by the diagonal
  // so the axis-aligned zone still covers the rotated cavity.
  const sh = CELLS.find((c) => c.id === 'SH')!;
  const shCenter = worldOf(new THREE.Vector3(sh.cx, 1.5, (sh.z0 + sh.z1) / 2));
  const shDiag = Math.sqrt(sh.hw * sh.hw + ((sh.z1 - sh.z0) / 2) ** 2) + 0.5;
  addShelterZone(shelter, shCenter, { x: shDiag, y: 2.0, z: shDiag });

  // ── Captain's log — on the bridge console (R6), met on arrival.
  if (journals) {
    const jw = worldOf(new THREE.Vector3(2.0, 3.2, 72));
    journals.list.push(placeJournal(scene, jw, yaw + Math.PI, 'mega_wreck'));
  }

  // ── Half-burial: asymmetric sand mounds on the -X lee flank + buried bow nose.
  {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const wd = new THREE.Vector2(-cos, -sin);
    const lee: Array<[number, number, number]> = [
      [-13, 0, 14], [-13, 30, 16], [-12, 55, 13], [-10, -30, 12], [-2, -56, 16],
    ];
    for (const [lx, lz, sz] of lee) {
      const w = worldOf(new THREE.Vector3(lx, 0, lz));
      scene.add(makeSandMound(_terrain, w.x, w.z, wd, sz, rand));
    }
    const noseW = worldOf(new THREE.Vector3(0, 0, -62));
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(7, 16), new THREE.MeshLambertMaterial({ color: 0x3a2c20 }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.set(noseW.x, _terrain.heightAt(noseW.x, noseW.z) + 0.04, noseW.z);
    scorch.userData.noCollider = true; scorch.userData.noShadow = true; scene.add(scorch);
  }

  // ── Surrounding debris field.
  placeDebrisField(scene, _terrain, pos, 50, rand, 40);

  return group;
}
