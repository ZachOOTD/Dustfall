// Verlet rope sim (M9 ⑫, C54) — a small position-based rope solver for the VISUAL
// rope (the tube mesh's sag/swing), behind FEATURES.realRope. OFF = the proven
// static mid-point sag (rebuildRopeMesh's slack-droop) runs unchanged.
//
// Scope of this [partial]: the solver + the sled-tow rope VISUAL only. It drives the
// rope mesh's interior points so the rope HANGS, SWINGS, and goes TAUT dynamically
// (vs. the static droop), but it does NOT yet drive the towed body's physics — the
// inextensible body constraint (ropeConstraint.ts, D126) is unchanged. The body
// coupling + CCD (D124, needed only once the rope drives bodies) + the other 3 callers
// (companion tether / stake / kill-drag) are the ⑫-continuation.
//
// Classic position-based Verlet: interior points integrate (pos += pos - prev + g·dt²),
// the two endpoints are pinned to the anchor + attach each frame, then distance
// constraints relax toward a per-segment rest length (= ropeLength / segments) over a
// few iterations. Endpoints closer than ropeLength → the chain sags under gravity;
// at ropeLength → it pulls straight (taut). Pure + deterministic given the inputs.

import * as THREE from 'three';

export interface RopeVerlet {
  pts: THREE.Vector3[];    // segments+1 sim points; [0] = anchor end, [last] = attach end
  prev: THREE.Vector3[];   // previous positions (Verlet velocity = pts - prev)
  segs: number;
}

/** Allocate a rope laid straight between p0 and pN (so it doesn't snap from a cold start). */
export function makeRopeVerlet(segs: number, p0: THREE.Vector3, pN: THREE.Vector3): RopeVerlet {
  const pts: THREE.Vector3[] = [];
  const prev: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = new THREE.Vector3().lerpVectors(p0, pN, t);
    pts.push(p.clone());
    prev.push(p.clone());
  }
  return { pts, prev, segs };
}

const _tmp = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Step the rope one frame: pin the ends to p0/pN, integrate the interior under gravity,
 *  then relax distance constraints toward restLen = ropeLength/segs. `dt` is clamped so a
 *  long frame can't explode the sim. */
export function stepRopeVerlet(
  r: RopeVerlet,
  p0: THREE.Vector3,
  pN: THREE.Vector3,
  dt: number,
  ropeLength: number,
  gravity: number,
  iterations: number,
  damping: number,
): void {
  const h = Math.min(dt, 1 / 30);          // clamp the step (stability on slow frames)
  const g = gravity * h * h;
  // Verlet integrate the INTERIOR points (endpoints are pinned below).
  for (let i = 1; i < r.segs; i++) {
    const p = r.pts[i], pv = r.prev[i];
    _tmp.copy(p);
    // pos += (pos - prev) * damping + gravity
    p.x += (p.x - pv.x) * damping;
    p.y += (p.y - pv.y) * damping - g;
    p.z += (p.z - pv.z) * damping;
    pv.copy(_tmp);
  }
  // Pin endpoints to the live anchor + attach.
  r.pts[0].copy(p0); r.prev[0].copy(p0);
  r.pts[r.segs].copy(pN); r.prev[r.segs].copy(pN);
  // Relax distance constraints toward the rest segment length.
  const rest = ropeLength / r.segs;
  for (let k = 0; k < iterations; k++) {
    for (let i = 0; i < r.segs; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      _d.subVectors(b, a);
      const len = _d.length() || 1e-5;
      const diff = (len - rest) / len;
      const aPinned = i === 0;
      const bPinned = i + 1 === r.segs;
      // move each free end half the correction (a pinned end takes none, the free end takes all)
      const wa = aPinned ? 0 : (bPinned ? 1 : 0.5);
      const wb = bPinned ? 0 : (aPinned ? 1 : 0.5);
      a.x += _d.x * diff * wa; a.y += _d.y * diff * wa; a.z += _d.z * diff * wa;
      b.x -= _d.x * diff * wb; b.y -= _d.y * diff * wb; b.z -= _d.z * diff * wb;
    }
  }
}
