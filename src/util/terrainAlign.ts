// Session ABA — shared terrain-slope alignment helper (lifted from
// `src/world/tent.ts` + `src/world/largeTent.ts` + `src/enemies/companion.ts`
// where it was duplicated 3 times). Per D98, once we'd consider a 4th
// caller it's time to extract; the procgen wreck system (P7) would be
// that 4th caller, so the lift happens now.
//
// API: `alignToTerrain(obj, terrain, x, z, yaw, sampleRadius)`. Samples
// the terrain heightfield at 4 cardinal offsets ±sampleRadius around
// (x, z), computes the finite-difference gradient → surface normal,
// projects the desired forward (the yaw heading in world XZ) onto the
// plane perpendicular to that normal, and sets `obj.quaternion` to
// the resulting basis. Heading is preserved when the slope is gentle;
// on steep slopes the projection lengths shorten but the basis stays
// orthonormal.
//
// Module-level scratch vectors mean per-frame callers (companion ticks
// each frame on its own position) pay zero allocation cost. Per-frame
// callers must NOT call this from concurrent contexts (which doesn't
// happen in the main-thread tick loop, but worth noting for future
// worker-offload).

import * as THREE from 'three';

const _alignN = new THREE.Vector3();
const _alignF = new THREE.Vector3();
const _alignR = new THREE.Vector3();
const _alignTmp = new THREE.Vector3();
const _alignBasis = new THREE.Matrix4();

interface TerrainSampler {
  heightAt: (x: number, z: number) => number;
}

/** Align `obj`'s quaternion so its local +Y points along the terrain
 *  normal at (x, z), its local +Z points in the yaw direction
 *  projected onto the slope's tangent plane, and its local +X is
 *  perpendicular to both.
 *
 *  @param obj           The Three.js Object3D to orient. `obj.quaternion`
 *                       is overwritten; `obj.position` is NOT changed.
 *  @param terrain       Any object exposing `heightAt(x, z): number`.
 *  @param x             World X position of the object (for terrain sampling center).
 *  @param z             World Z position of the object.
 *  @param yaw           Desired heading in radians (yaw around world +Y).
 *                       Maps to local +Z = (sin yaw, 0, cos yaw) when the
 *                       terrain is flat — matches the legacy
 *                       `mesh.rotation.y = yaw` semantics.
 *  @param sampleRadius  Distance (m) from (x, z) at which to sample the
 *                       four cardinal heights for the gradient. Smaller
 *                       radius = sharper local conformance; larger radius
 *                       = smoother averaging over terrain bumps. Typical
 *                       values: 0.5–2.0m for placeables, 0.4–0.8m for
 *                       walking creatures. */
export function alignToTerrain(
  obj: THREE.Object3D,
  terrain: TerrainSampler,
  x: number,
  z: number,
  yaw: number,
  sampleRadius: number,
): void {
  const hE = terrain.heightAt(x + sampleRadius, z);
  const hW = terrain.heightAt(x - sampleRadius, z);
  const hN = terrain.heightAt(x, z + sampleRadius);
  const hS = terrain.heightAt(x, z - sampleRadius);
  // Slope gradient (height-per-meter along each axis).
  const dxGrad = (hE - hW) / (2 * sampleRadius);
  const dzGrad = (hN - hS) / (2 * sampleRadius);
  // Terrain normal (right-handed, +Y up). When the ground rises in +X,
  // the normal tilts toward -X.
  _alignN.set(-dxGrad, 1, -dzGrad).normalize();
  // Desired forward in world XZ-plane (legacy `rotation.y = yaw` semantics).
  _alignF.set(Math.sin(yaw), 0, Math.cos(yaw));
  // Project onto the plane perpendicular to `normal` so forward + up
  // are orthogonal. If the forward is nearly parallel to the normal
  // (cliff edge case), the projection collapses — fall back to world
  // forward to avoid a zero-length basis vector.
  _alignTmp.copy(_alignN).multiplyScalar(_alignF.dot(_alignN));
  _alignF.sub(_alignTmp);
  if (_alignF.lengthSq() < 1e-6) _alignF.set(0, 0, 1);
  _alignF.normalize();
  // Right = normal × forward (orthonormal); then re-derive forward to
  // ensure perfect orthonormality despite floating-point drift.
  _alignR.crossVectors(_alignN, _alignF).normalize();
  _alignF.crossVectors(_alignR, _alignN).normalize();
  _alignBasis.makeBasis(_alignR, _alignN, _alignF);
  obj.quaternion.setFromRotationMatrix(_alignBasis);
}
