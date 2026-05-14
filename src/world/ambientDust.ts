// Toned-down ambient particle drift — like the sandstorm, but always on and
// barely visible. Suppressed when the sandstorm is active (the storm replaces
// it; double-drawing would just thicken the visible mass for no gain).
//
// Mirrors weather.ts's wrap-around-camera pattern so the cloud stays
// centered on the player without ever generating new particles.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

export interface AmbientDust {
  particles: THREE.Points;
  particleMat: THREE.PointsMaterial;
  particleVels: Float32Array;
  cameraRef: THREE.PerspectiveCamera;
}

export function createAmbientDust(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): AmbientDust {
  const count = Tuning.AMBIENT_DUST_COUNT;
  const spread = Tuning.AMBIENT_DUST_SPREAD;
  const positions = new Float32Array(count * 3);
  const vels = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = Math.random() * 12 - 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    // Slow drift along the same prevailing wind axis as the storm.
    vels[i * 3]     = 0.6 + (Math.random() - 0.5) * 0.3;
    vels[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
    vels[i * 3 + 2] = -0.35 + (Math.random() - 0.5) * 0.25;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xb89878,
    size: 0.10,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,            // fog the dust so it dies at the world horizon
    toneMapped: false,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false;
  scene.add(particles);

  return { particles, particleMat: mat, particleVels: vels, cameraRef: camera };
}

const _camPos = new THREE.Vector3();

export function updateAmbientDust(ctx: GameContext, dt: number): void {
  const a = ctx.ambientDust;
  if (!a) return;

  // When the storm is building or active, hide our layer entirely.
  const storm = ctx.weather.intensity;
  const wantVisible = storm < Tuning.AMBIENT_DUST_SUPPRESS_STORM;
  if (a.particles.visible !== wantVisible) a.particles.visible = wantVisible;
  if (!wantVisible) return;

  // Opacity fades down as we approach the storm suppression threshold so the
  // handoff feels smooth instead of popping off.
  const fade = 1 - storm / Tuning.AMBIENT_DUST_SUPPRESS_STORM;
  a.particleMat.opacity = Tuning.AMBIENT_DUST_OPACITY * fade;

  // Drift + wrap. Identical structure to weather.ts.
  _camPos.copy(a.cameraRef.position);
  const spread = Tuning.AMBIENT_DUST_SPREAD;
  const half = spread / 2;
  const posAttr = a.particles.geometry.attributes.position;
  const arr = posAttr.array as Float32Array;
  const vels = a.particleVels;
  const count = Tuning.AMBIENT_DUST_COUNT;

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    arr[ix]     += vels[ix]     * dt;
    arr[ix + 1] += vels[ix + 1] * dt;
    arr[ix + 2] += vels[ix + 2] * dt;

    let lx = arr[ix]     - _camPos.x;
    let ly = arr[ix + 1] - _camPos.y;
    let lz = arr[ix + 2] - _camPos.z;
    if (lx >  half) lx -= spread;
    if (lx < -half) lx += spread;
    if (ly >  6)    ly -= 12;
    if (ly < -6)    ly += 12;
    if (lz >  half) lz -= spread;
    if (lz < -half) lz += spread;
    arr[ix]     = _camPos.x + lx;
    arr[ix + 1] = _camPos.y + ly;
    arr[ix + 2] = _camPos.z + lz;
  }
  posAttr.needsUpdate = true;
}
