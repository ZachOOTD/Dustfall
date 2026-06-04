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

  // Main shaft — ONE continuous tapered cylinder (thick base → thin tip). A
  // single mesh means there is NO seam/joint anywhere along the length — just a
  // smooth slight taper. A gentle organic bow is baked into the vertices (so it
  // isn't a dead-straight CG cone) WITHOUT introducing a discontinuity. Twigs
  // attach on the local radius `localR(f)` so they sit flush on the taper.
  // (rotation.z=π/2 maps cylinder TOP→-X, BOTTOM→+X.)
  const Rbase = r, Rtip = r * 0.5;
  const localR = (f: number) => Rbase + (Rtip - Rbase) * (f + 0.5);   // radius at along-fraction f∈[-0.5,0.5]
  const shaftGeo = new THREE.CylinderGeometry(Rtip, Rbase, len, 8, 8);  // top(-X)=tip, bottom(+X)=base
  // Bake a faint bow: displace each vertex in local Z by a parabola of its
  // along-length position (0 at the ends, max at mid) so the stick curves
  // smoothly instead of running perfectly straight. Single mesh → seamless.
  const bow = len * (0.045 + jit(0.03));
  const pos = shaftGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const yN = pos.getY(i) / (len * 0.5);          // -1..1 along the shaft
    pos.setZ(i, pos.getZ(i) + bow * (1 - yN * yN));
  }
  shaftGeo.computeVertexNormals();
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.rotation.z = Math.PI / 2;
  group.add(shaft);
  // Bow offset (in shaft-local Z) at along-fraction f — used to keep twigs on
  // the bowed surface. Matches the parabola above (yN = 2f).
  const bowAt = (f: number) => bow * (1 - (2 * f) * (2 * f));

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
    const lr = localR(f);                   // shaft radius at THIS point (so twigs sit on the tapered surface)
    _radial.set(0, Math.cos(th), Math.sin(th));
    _dir.copy(_radial).addScaledVector(_X, lean).normalize();   // radial + lean down the branch
    const twigLen = len * ls;

    const tg = new THREE.Group();
    // +bowAt(f) follows the bowed shaft centerline (local Z survives rotation.z).
    tg.position.set(along, _radial.y * lr * 0.78, bowAt(f) + _radial.z * lr * 0.78);   // on the shaft surface (overlap slightly)
    tg.quaternion.setFromUnitVectors(_UP, _dir);
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(lr * 0.22, lr * 0.5, twigLen, 5), mat);
    twig.position.y = twigLen * 0.5;     // base at the subgroup origin, extends +Y (= _dir)
    tg.add(twig);
    // Tiny secondary fork near the tip of the longer twigs.
    if (ls > 0.2) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(lr * 0.12, lr * 0.28, twigLen * 0.5, 4), mat);
      const fg = new THREE.Group();
      fg.position.y = twigLen * 0.72;
      fg.rotation.z = 0.8;
      fork.position.y = twigLen * 0.25;
      fg.add(fork);
      tg.add(fg);
    }
    group.add(tg);
    // Small base collar (local-radius sized) to round the twig→shaft junction.
    const collar = new THREE.Mesh(new THREE.SphereGeometry(lr * 0.5, 6, 5), mat);
    collar.position.copy(tg.position);
    group.add(collar);
  }
  return group;
}
