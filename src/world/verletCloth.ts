// Verlet cloth sim (M9 ⑬, C56) — a 2D position-based cloth solver for the VISUAL
// fabric (a hanging door-flap), behind FEATURES.realCloth. OFF = the proven static
// catenary-sag panel (makeSaggedFabricPanel / the flat door PlaneGeometry) runs unchanged.
//
// This is the 2D extension of verletRope.ts (M9 ⑫): the same Verlet integrate + relax
// loop, but over a GRID of point-masses with structural distance constraints to each
// point's right + down neighbour, and the TOP ROW pinned (a cloth hanging from a lintel).
// Gravity pulls it down; a gentle wind billows it along its local Z. Pure + deterministic
// given the inputs. Scope (this [partial]): the solver + the large-tent door-flap VISUAL
// only — no collision, no save state, no other fabric surfaces.
//
// Operates in the panel geometry's LOCAL space (the PlaneGeometry verts), so the parent
// mesh transform still orients/positions the flap in the world. Gravity is local -Y (the
// hang direction of an upright PlaneGeometry); wind is local +Z (the doorway normal).

import * as THREE from 'three';

export interface VerletCloth {
  cols: number;             // verts across (segW + 1)
  rows: number;             // verts down  (segH + 1)
  pos: THREE.Vector3[];     // current local positions (row-major: i = iy*cols + ix)
  prev: THREE.Vector3[];    // previous (Verlet velocity = pos - prev)
  rest: THREE.Vector3[];    // rest positions (pin targets for the top row)
  hRest: number;            // horizontal structural rest length
  vRest: number;            // vertical structural rest length
}

/** Build a cloth grid from a subdivided PlaneGeometry's local vertices (its rest shape).
 *  `segW`/`segH` are the geometry's width/height segment counts. */
export function makeVerletCloth(geo: THREE.BufferGeometry, segW: number, segH: number): VerletCloth {
  const cols = segW + 1, rows = segH + 1;
  const attr = geo.attributes.position;
  const pos: THREE.Vector3[] = [];
  const prev: THREE.Vector3[] = [];
  const rest: THREE.Vector3[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const v = new THREE.Vector3(attr.getX(i), attr.getY(i), attr.getZ(i));
    pos.push(v.clone());
    prev.push(v.clone());
    rest.push(v.clone());
  }
  const hRest = rest[0].distanceTo(rest[1]) || 0.1;
  const vRest = rest[0].distanceTo(rest[cols]) || 0.1;
  return { cols, rows, pos, prev, rest, hRest, vRest };
}

const _tmp = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Step the cloth one frame: integrate the free points under gravity + wind, pin the top
 *  row to its rest position, then relax structural distance constraints over `iters`
 *  iterations. `dt` is clamped so a long frame can't explode the sim. */
export function stepVerletCloth(
  c: VerletCloth,
  dt: number,
  gravity: number,
  windX: number,
  windZ: number,
  iters: number,
  damping: number,
): void {
  const h = Math.min(dt, 1 / 30);
  const g = gravity * h * h;
  const wx = windX * h * h, wz = windZ * h * h;
  const { cols, rows, pos, prev } = c;
  // Verlet integrate every point EXCEPT the pinned top row (iy === 0).
  for (let iy = 1; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iy * cols + ix;
      const p = pos[i], pv = prev[i];
      _tmp.copy(p);
      p.x += (p.x - pv.x) * damping + wx;
      p.y += (p.y - pv.y) * damping - g;
      p.z += (p.z - pv.z) * damping + wz;
      pv.copy(_tmp);
    }
  }
  // Pin the top row to its rest position (the lintel).
  for (let ix = 0; ix < cols; ix++) {
    const i = ix; // iy = 0
    pos[i].copy(c.rest[i]);
    prev[i].copy(c.rest[i]);
  }
  // Relax structural constraints (right + down neighbours) toward their rest lengths.
  for (let k = 0; k < iters; k++) {
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const i = iy * cols + ix;
        if (ix + 1 < cols) solveLink(c, i, i + 1, c.hRest);       // horizontal
        if (iy + 1 < rows) solveLink(c, i, i + cols, c.vRest);    // vertical
      }
    }
  }
}

/** Pull two grid points toward `rest` apart; a pinned top-row point (iy 0) takes none. */
function solveLink(c: VerletCloth, ia: number, ib: number, rest: number): void {
  const a = c.pos[ia], b = c.pos[ib];
  _d.subVectors(b, a);
  const len = _d.length() || 1e-5;
  const diff = (len - rest) / len;
  const aPinned = ia < c.cols;   // top row
  const bPinned = ib < c.cols;
  const wa = aPinned ? 0 : (bPinned ? 1 : 0.5);
  const wb = bPinned ? 0 : (aPinned ? 1 : 0.5);
  a.x += _d.x * diff * wa; a.y += _d.y * diff * wa; a.z += _d.z * diff * wa;
  b.x -= _d.x * diff * wb; b.y -= _d.y * diff * wb; b.z -= _d.z * diff * wb;
}

/** Write the simulated grid back to the geometry's position attribute + refresh normals. */
export function applyClothToGeometry(c: VerletCloth, geo: THREE.BufferGeometry): void {
  const attr = geo.attributes.position;
  for (let i = 0; i < c.pos.length; i++) {
    const p = c.pos[i];
    attr.setXYZ(i, p.x, p.y, p.z);
  }
  attr.needsUpdate = true;
  geo.computeVertexNormals();
}
