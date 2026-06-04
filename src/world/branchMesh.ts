// Shared branch model — the item viewmodel (src/inventory/items.ts) and the
// world pickups under dead trees (src/pickups/pickups.ts) both build their
// branch from THIS function so they read as the same object. The caller
// supplies the material: the held item passes a wood-grain shader (vmWood);
// world pickups pass a plain Lambert grey (there are ~200 in-world, so the
// cheaper material matters — see pickups.ts perf note). Geometry/shape is
// identical either way. A canonical branch lies along +X; callers orient it.
//
// ACAA — replaces the per-site primitives + drops the splinter "bristles" +
// knot bumps the ACZ item branch had (they read as weird clutter).

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';

export interface BranchMeshOpts {
  /** Overall length of the main stick (m). Default 0.34 (item scale). */
  len?: number;
  /** Number of offshoot twigs (0-3). Default 3. */
  twigs?: number;
  /** Optional RNG to jitter twig placement; deterministic fixed layout if absent. */
  rand?: Rng;
}

const _UP = new THREE.Vector3(0, 1, 0);
const _X = new THREE.Vector3(1, 0, 0);
const _dir = new THREE.Vector3();
const _radial = new THREE.Vector3();

export function buildBranchMesh(mat: THREE.Material, opts: BranchMeshOpts = {}): THREE.Group {
  const group = new THREE.Group();
  const len = opts.len ?? 0.34;
  const r = len * 0.05;             // proportional radius so big + small branches match
  const rand = opts.rand;
  const jit = (s: number) => (rand ? (rand() - 0.5) * s : 0);

  // Main shaft — tapered 8-sided cylinder lying along +X, with a slight bend at
  // mid-length so it reads as natural deadwood, not a dowel.
  const seg1 = len * 0.54, seg2 = len - seg1;
  const s1 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, seg1, 8), mat);
  s1.rotation.z = Math.PI / 2;
  s1.position.x = -len * 0.5 + seg1 * 0.5;
  group.add(s1);
  // Segment 2 continues from segment 1's far end, angled by `bend` in XZ.
  const jointX = -len * 0.5 + seg1;
  const bend = 0.16 + jit(0.1);
  const s2g = new THREE.Group();
  s2g.position.set(jointX, 0, 0);
  s2g.rotation.y = bend;
  const s2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.82, seg2, 8), mat);
  s2.rotation.z = Math.PI / 2;
  s2.position.x = seg2 * 0.5;
  s2g.add(s2);
  group.add(s2g);
  // Knuckle at the bend joint.
  const joint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 7, 5), mat);
  joint.position.set(jointX, 0, 0); joint.scale.set(1, 0.85, 0.85);
  group.add(joint);

  // Side twigs — each EMERGES FROM THE SHAFT SURFACE and angles outward + a bit
  // along the branch (never crosses through). A small base collar hides the
  // joint. Built in a per-twig subgroup oriented so +Y points down the twig.
  const twigCount = Math.max(0, Math.min(4, opts.twigs ?? 3));
  // [along-fraction (-0.5..0.5), around-angle θ (rad), length-scale, forward-lean]
  const specs: Array<[number, number, number, number]> = [
    [0.18, 0.5, 0.34, 0.55],
    [-0.10, 2.5, 0.24, -0.45],
    [0.32, 4.2, 0.17, 0.5],
    [-0.26, 5.5, 0.14, -0.35],
  ];
  for (let i = 0; i < twigCount; i++) {
    const [f, th0, ls, lean] = specs[i];
    const th = th0 + jit(0.5);
    const along = f * len + jit(0.02);
    _radial.set(0, Math.cos(th), Math.sin(th));
    _dir.copy(_radial).addScaledVector(_X, lean).normalize();   // radial + lean down the branch
    const twigLen = len * ls;

    const tg = new THREE.Group();
    tg.position.set(along, _radial.y * r * 0.8, _radial.z * r * 0.8);   // on the shaft surface
    tg.quaternion.setFromUnitVectors(_UP, _dir);
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.42, twigLen, 5), mat);
    twig.position.y = twigLen * 0.5;     // base at the subgroup origin, extends +Y (= _dir)
    tg.add(twig);
    // Tiny secondary fork near the tip of the longer twigs.
    if (ls > 0.2) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.24, twigLen * 0.5, 4), mat);
      const fg = new THREE.Group();
      fg.position.y = twigLen * 0.72;
      fg.rotation.z = 0.8;
      fork.position.y = twigLen * 0.25;
      fg.add(fork);
      tg.add(fg);
    }
    group.add(tg);
    const collar = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 6, 5), mat);
    collar.position.copy(tg.position);
    group.add(collar);
  }
  return group;
}
