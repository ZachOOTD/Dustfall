// Panel-with-hole utility (extracted from openingWreck.ts in Session BB so
// megaShip.ts can use it too).
//
// Given a flat panel size and a rectangular hole, returns a `THREE.Group`
// holding up to 4 sub-meshes that wrap the hole (top/bottom strips +
// left/right pieces in the hole's height band). Strips with zero size are
// skipped, so the helper handles holes flush with an edge gracefully.
//
// Orientation convention: the panel is flat in the X-Z plane with thickness
// along Y. `cu` (hole center along X) and `cv` (hole center along Z) are
// in panel-local space. Rotate the resulting Group to stand the panel up
// as a wall (e.g. rotation.z = ±π/2 for left/right side walls) or to tilt
// it for a roof slab.

import * as THREE from 'three';

export function panelWithHole(
  W: number, T: number, D: number,
  cu: number, cv: number,
  hw: number, hd: number,
  mat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const tol = 0.001;
  const halfHw = hw / 2;
  const halfHd = hd / 2;
  // Top strip — between hole's far edge and panel's far edge (along Z).
  const topLen = (D / 2) - (cv + halfHd);
  if (topLen > tol) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, T, topLen), mat);
    m.position.z = (cv + halfHd + D / 2) / 2;
    g.add(m);
  }
  // Bottom strip — between panel's near edge and hole's near edge (along Z).
  const botLen = (cv - halfHd) - (-D / 2);
  if (botLen > tol) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, T, botLen), mat);
    m.position.z = (-D / 2 + cv - halfHd) / 2;
    g.add(m);
  }
  // Left of hole (along X), spanning only the hole's Z band.
  const leftLen = (cu - halfHw) - (-W / 2);
  if (leftLen > tol) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(leftLen, T, hd), mat);
    m.position.set((-W / 2 + cu - halfHw) / 2, 0, cv);
    g.add(m);
  }
  // Right of hole (along X).
  const rightLen = (W / 2) - (cu + halfHw);
  if (rightLen > tol) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(rightLen, T, hd), mat);
    m.position.set((cu + halfHw + W / 2) / 2, 0, cv);
    g.add(m);
  }
  return g;
}
