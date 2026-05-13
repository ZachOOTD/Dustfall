// Geometry-shaping helpers for stylized primitive landmarks:
// noise-perturbed surfaces and height-based vertex color tinting.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';

/**
 * Perturb each vertex outward (along its radial direction) by a deterministic
 * pseudo-noise term derived from its position. Recomputes normals.
 * `strength` is fraction of vertex length (0.15 = up to 15% bumps).
 */
export function perturbOutward(
  geo: THREE.BufferGeometry,
  strength: number,
  seed: number,
): void {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 1e-5) continue;
    const s = seed * 0.0123;
    const n =
      Math.sin(x * 3.7 + y * 1.3 + s) * Math.cos(y * 2.4 + z * 0.8 - s) * 0.6 +
      Math.sin(z * 4.1 + x * 1.7 + s * 1.7) * 0.4;
    const scale = 1 + n * strength;
    p.setXYZ(i, x * scale, y * scale, z * scale);
  }
  geo.computeVertexNormals();
}

/**
 * Add per-vertex colors that tint by Y: top vertices lighter (sun-bleached),
 * bottom vertices darker (shadow / dust accumulation).
 */
export function tintByHeight(
  geo: THREE.BufferGeometry,
  baseColor: THREE.Color,
  rand: Rng,
): void {
  const p = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const range = Math.max(1e-3, maxY - minY);

  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = (y - minY) / range;       // 0 at bottom, 1 at top
    // Darken at bottom (0.55x), brighten at top (1.15x), with small hue jitter.
    const lightFactor = 0.55 + t * 0.6;
    const jitter = (rand() - 0.5) * 0.06; // ±3% per-vertex variation
    c.copy(baseColor).multiplyScalar(lightFactor + jitter);
    colors[i * 3] = Math.max(0, Math.min(1, c.r));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, c.g));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, c.b));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
