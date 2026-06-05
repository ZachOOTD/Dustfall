// Shared salvage-scrap model — the held item viewmodel (inventory/items.ts) and
// the world pickups scattered around wrecks (pickups.ts) both build their scrap
// from THIS function so they read as the same object (mirrors branchMesh.ts).
// The caller supplies the materials: the held item passes localSpace `vmMetal`
// variants; world pickups pass cheaper shared world-space metal. A single carried
// SCRAP is one chunk of scavenged hull debris — a torn/bent sheet-metal plate
// with a folded corner, a crumpled second plate, an angle bracket, rivets, a bent
// rebar stub and a little wire coil — NOT a whole pile (it's one inventory unit).
//
// ACAH — replaces the flat "box + 2 bolts" scrap that missed the ACY/ACZ pass.

import * as THREE from 'three';

export function buildScrapMesh(mat: THREE.Material, accentMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (r: number, h: number, seg: number, m: THREE.Material) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);

  // Main torn hull plate — thin, slightly trapezoidal, tilted; the dominant mass.
  const plate = box(0.11, 0.016, 0.085, mat);
  plate.rotation.set(0.18, 0.35, 0.08);
  g.add(plate);
  // Folded-up corner flap (bent off one edge) — breaks the flat-brick silhouette.
  const flap = box(0.05, 0.013, 0.05, mat);
  flap.position.set(0.046, 0.03, 0.018);
  flap.rotation.set(-0.85, 0.4, 0.2);
  g.add(flap);
  // Second crumpled plate (darker) overlapping at an angle.
  const plate2 = box(0.07, 0.013, 0.055, accentMat);
  plate2.position.set(-0.036, 0.024, -0.02);
  plate2.rotation.set(0.5, -0.3, -0.28);
  g.add(plate2);

  // L-shaped angle bracket riveted along one edge.
  const br1 = box(0.075, 0.012, 0.016, accentMat);
  br1.position.set(0.0, 0.006, 0.05);
  br1.rotation.y = 0.35;
  g.add(br1);
  const br2 = box(0.016, 0.03, 0.016, accentMat);
  br2.position.set(0.028, 0.02, 0.058);
  br2.rotation.y = 0.35;
  g.add(br2);

  // Rivets/bolts protruding from the plate.
  const bolts: Array<[number, number, number, number]> = [
    [0.03, 0.022, 0.0, 0.011],
    [-0.012, 0.024, 0.03, 0.009],
    [0.05, 0.018, -0.022, 0.008],
  ];
  for (const [x, y, z, r] of bolts) {
    const bolt = cyl(r, 0.02, 6, accentMat);
    bolt.position.set(x, y, z);
    bolt.rotation.set(Math.PI / 2 + 0.3, 0, 0.2);
    g.add(bolt);
  }

  // Bent rebar / rod stub poking out one side.
  const rod = cyl(0.0065, 0.10, 6, accentMat);
  rod.position.set(-0.05, 0.022, 0.0);
  rod.rotation.set(0.2, 0, Math.PI / 2 - 0.5);
  g.add(rod);
  const rodBent = cyl(0.0055, 0.045, 6, accentMat);
  rodBent.position.set(-0.094, 0.05, 0.0);
  rodBent.rotation.set(0.2, 0, -0.25);
  g.add(rodBent);

  // Small wire coil snagged on the debris (a couple of thin loops).
  for (let i = 0; i < 2; i++) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0035, 5, 10), accentMat);
    loop.position.set(0.042 + i * 0.004, 0.034 + i * 0.007, 0.03);
    loop.rotation.set(0.6, 0.3, i * 0.5);
    g.add(loop);
  }

  return g;
}
