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

export function buildBranchMesh(mat: THREE.Material, opts: BranchMeshOpts = {}): THREE.Group {
  const group = new THREE.Group();
  const len = opts.len ?? 0.34;
  const r = len * 0.055;            // proportional radius so big + small branches match
  const rand = opts.rand;
  const jit = (s: number) => (rand ? (rand() - 0.5) * s : 0);

  // Main shaft — rounder 8-sided cylinder, gently tapered, lying along +X.
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, len, 8), mat);
  stick.rotation.z = Math.PI / 2;
  group.add(stick);

  // Offshoot twigs — a couple of natural side stubs (NO splintered bristles).
  const twigCount = Math.max(0, Math.min(3, opts.twigs ?? 3));
  const specs: Array<[number, number, number]> = [
    // [along-stick fraction (-0.5..0.5), tilt, lengthScale]
    [0.18, -0.7, 0.26],
    [-0.12, 0.85, 0.18],
    [0.04, -1.1, 0.13],
  ];
  for (let i = 0; i < twigCount; i++) {
    const [f, tilt, ls] = specs[i];
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.34, r * 0.5, len * ls, 5), mat);
    twig.position.set(f * len + jit(0.04), jit(0.01), jit(0.012));
    twig.rotation.set(jit(0.4), 0, Math.PI / 2 + tilt + jit(0.3));
    group.add(twig);
  }
  return group;
}
