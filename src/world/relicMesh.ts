// Relic-core model (Cycle 8 / Session ACAQ). A glowing alien-tech orb cradled in
// a torn dark-metal housing. Shared by the held viewmodel (items.ts) AND the
// world pickup (pickups.ts) so they match — the buildScrapMesh/buildBranchMesh
// pattern (D178). The emissive core uses MeshBasic so it reads as a light source
// (like the energy-pistol cells), making the rare loot findable in the graveyard.

import * as THREE from 'three';

const _coreMat = new THREE.MeshBasicMaterial({ color: 0x5fe8b8 });   // glowing cyan-green
const _pipMat = new THREE.MeshBasicMaterial({ color: 0xeafff2 });    // bright inner pip
const _housingMat = new THREE.MeshLambertMaterial({ color: 0x4a3b2c, flatShading: true });  // dark rusted bronze

/** Build the relic-core mesh (~0.16m). Static-safe (MeshBasic core, Lambert
 *  housing — no view-space procedural noise, so it's identical held or in-world). */
export function buildRelicCoreMesh(): THREE.Group {
  const g = new THREE.Group();

  // Glowing faceted core + a brighter inner pip.
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), _coreMat);
  g.add(core);
  const pip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028, 0), _pipMat);
  g.add(pip);

  // Base ring — a torn metal collar the core sits in.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.013, 6, 16), _housingMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.03;
  g.add(ring);

  // Three bent struts arching up around the core (a half-cage housing).
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.11, 0.016), _housingMat);
    strut.position.set(Math.cos(a) * 0.066, 0.01, Math.sin(a) * 0.066);
    strut.rotation.z = Math.cos(a) * 0.5;
    strut.rotation.x = -Math.sin(a) * 0.5;
    g.add(strut);
  }

  return g;
}
