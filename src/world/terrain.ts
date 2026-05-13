// Dune terrain: layered simplex heightmap mesh + matching Rapier heightfield.
// Both share the same heights array — the visual mesh and the collider are
// generated from identical samples so they overlay exactly.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { BiomeSampler } from './biomes.ts';
import { Tuning } from '../config/tuning.ts';

const SIZE = 800;   // world units across the square terrain
const CELLS = 128;  // cells per side; vertices = (CELLS+1)^2

// Per-biome ground colors (Session P). Punchier than first-pass so the
// regions read clearly from a distance: dune = saturated orange-sand,
// rocky = dark red-brown, salt = bright warm-white.
const BIOME_COLOR_DUNE: readonly [number, number, number] = [0xcd / 255, 0x95 / 255, 0x55 / 255];
const BIOME_COLOR_ROCKY: readonly [number, number, number] = [0x55 / 255, 0x36 / 255, 0x1f / 255];
const BIOME_COLOR_SALT: readonly [number, number, number] = [0xf0 / 255, 0xe8 / 255, 0xd2 / 255];

// Smooth color blend driven by the biome noise scalar in [-1, 1]. Avoids the
// hard color seam you'd get from a discrete biome lookup.
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Smooth biome-to-height-scale lookup. Mirrors the color blend so the height
// transitions match the visual transitions exactly.
function biomeHeightScale(noiseVal: number): number {
  const rockyT = Tuning.BIOME_THRESHOLD_ROCKY;
  const saltT = Tuning.BIOME_THRESHOLD_SALT;
  const W = _BIOME_BLEND_WIDTH;
  if (noiseVal < rockyT - W) return Tuning.BIOME_HEIGHT_SCALE_ROCKY;
  if (noiseVal < rockyT + W) {
    const t = smoothstep(rockyT - W, rockyT + W, noiseVal);
    return Tuning.BIOME_HEIGHT_SCALE_ROCKY +
      (Tuning.BIOME_HEIGHT_SCALE_DUNE - Tuning.BIOME_HEIGHT_SCALE_ROCKY) * t;
  }
  if (noiseVal < saltT - W) return Tuning.BIOME_HEIGHT_SCALE_DUNE;
  if (noiseVal < saltT + W) {
    const t = smoothstep(saltT - W, saltT + W, noiseVal);
    return Tuning.BIOME_HEIGHT_SCALE_DUNE +
      (Tuning.BIOME_HEIGHT_SCALE_SALT - Tuning.BIOME_HEIGHT_SCALE_DUNE) * t;
  }
  return Tuning.BIOME_HEIGHT_SCALE_SALT;
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

const _BIOME_BLEND_WIDTH = 0.08;
function blendedBiomeColor(noiseVal: number): [number, number, number] {
  const rockyT = Tuning.BIOME_THRESHOLD_ROCKY;
  const saltT = Tuning.BIOME_THRESHOLD_SALT;
  // Below rockyT → rocky. Cross into dune over a blend band.
  if (noiseVal < rockyT - _BIOME_BLEND_WIDTH) return [...BIOME_COLOR_ROCKY];
  if (noiseVal < rockyT + _BIOME_BLEND_WIDTH) {
    const t = smoothstep(rockyT - _BIOME_BLEND_WIDTH, rockyT + _BIOME_BLEND_WIDTH, noiseVal);
    return lerp3(BIOME_COLOR_ROCKY, BIOME_COLOR_DUNE, t);
  }
  if (noiseVal < saltT - _BIOME_BLEND_WIDTH) return [...BIOME_COLOR_DUNE];
  if (noiseVal < saltT + _BIOME_BLEND_WIDTH) {
    const t = smoothstep(saltT - _BIOME_BLEND_WIDTH, saltT + _BIOME_BLEND_WIDTH, noiseVal);
    return lerp3(BIOME_COLOR_DUNE, BIOME_COLOR_SALT, t);
  }
  return [...BIOME_COLOR_SALT];
}

export interface Terrain {
  mesh: THREE.Mesh;
  heights: Float32Array; // length (CELLS+1)^2, indexed [i*(CELLS+1)+j]
  /** Bilinear sample of terrain height at world (x, z). 0 outside bounds. */
  heightAt: (x: number, z: number) => number;
  /** Approximate normal at world (x, z) using neighboring samples. */
  normalAt: (x: number, z: number) => THREE.Vector3;
}

export function createTerrain(
  scene: THREE.Scene,
  world: RAPIER.World,
  rand: Rng,
  biomes: BiomeSampler,
): Terrain {
  const noise = createNoise2D(rand);

  const heights = new Float32Array((CELLS + 1) * (CELLS + 1));
  for (let i = 0; i <= CELLS; i++) {
    for (let j = 0; j <= CELLS; j++) {
      const x = (i / CELLS - 0.5) * SIZE;
      const z = (j / CELLS - 0.5) * SIZE;
      // Biome-driven height multiplier — salt flats end up almost level,
      // rocky biomes slightly more rugged, dune normal. Smooth via the raw
      // biome noise so transitions are continuous (no discontinuity at the
      // hard biome threshold).
      const flatness = biomeHeightScale(biomes.rawAt(x, z));
      heights[i * (CELLS + 1) + j] = sampleHeight(noise, x, z) * flatness;
    }
  }

  // --- Three.js mesh ---
  const vertCount = (CELLS + 1) * (CELLS + 1);
  const positions = new Float32Array(vertCount * 3);
  // Per-vertex biome color (Session P). Lambert respects vertexColors:true.
  const colors = new Float32Array(vertCount * 3);
  for (let i = 0; i <= CELLS; i++) {
    for (let j = 0; j <= CELLS; j++) {
      const idx = (i * (CELLS + 1) + j) * 3;
      const x = (i / CELLS - 0.5) * SIZE;
      const z = (j / CELLS - 0.5) * SIZE;
      positions[idx] = x;
      positions[idx + 1] = heights[i * (CELLS + 1) + j];
      positions[idx + 2] = z;
      // Soft-blend the biome color: take a wider neighborhood average so the
      // transition isn't a hard line. Two extra noise samples + a smoothstep
      // weight on the raw biome noise gives a believable gradient.
      const n = biomes.rawAt(x, z);
      const c = blendedBiomeColor(n);
      colors[idx]     = c[0];
      colors[idx + 1] = c[1];
      colors[idx + 2] = c[2];
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const a = i * (CELLS + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (CELLS + 1) + j;
      const d = c + 1;
      // Two triangles per cell. Three.js front face = CCW; we want the
      // normal to point +Y (up). Vertex layout:
      //   a (i,j) ----- b (i,j+1)
      //     |             |
      //   c (i+1,j) --- d (i+1,j+1)
      // Triangles (a,b,c) and (b,d,c) both have normal (0,+1,0).
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // --- Rapier heightfield collider ---
  // Rapier docs: vertex (i,j) is at local (i/nrows - 0.5)*scale.x,
  //              heights[i*(ncols+1)+j]*scale.y,
  //              (j/ncols - 0.5)*scale.z.
  // Our indexing already matches. Scale x/z by SIZE, y by 1 (heights in meters).
  const colliderDesc = RAPIER.ColliderDesc.heightfield(
    CELLS, CELLS, heights,
    { x: SIZE, y: 1, z: SIZE },
  );
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(colliderDesc, body);

  // --- Sampling helpers ---
  const heightAt = (x: number, z: number): number => {
    const fi = (x / SIZE + 0.5) * CELLS;
    const fj = (z / SIZE + 0.5) * CELLS;
    if (fi < 0 || fi >= CELLS || fj < 0 || fj >= CELLS) return 0;
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const tx = fi - i;
    const tz = fj - j;
    const stride = CELLS + 1;
    const h00 = heights[i * stride + j];
    const h10 = heights[(i + 1) * stride + j];
    const h01 = heights[i * stride + (j + 1)];
    const h11 = heights[(i + 1) * stride + (j + 1)];
    return (
      h00 * (1 - tx) * (1 - tz) +
      h10 * tx * (1 - tz) +
      h01 * (1 - tx) * tz +
      h11 * tx * tz
    );
  };

  const _n = new THREE.Vector3();
  const normalAt = (x: number, z: number): THREE.Vector3 => {
    const e = 0.5;
    const hL = heightAt(x - e, z);
    const hR = heightAt(x + e, z);
    const hD = heightAt(x, z - e);
    const hU = heightAt(x, z + e);
    _n.set(hL - hR, 2 * e, hD - hU).normalize();
    return _n;
  };

  return { mesh, heights, heightAt, normalAt };
}

// Ridged + wind-warped dunes (Session P). Long parallel sand ridges run
// perpendicular to the prevailing wind direction. Stylized — not physically
// simulated — but reads as a desert from any angle.
//
// Pipeline per (x, z):
//   1. Rotate world coords into wind-aligned (u, v): u along wind, v across.
//   2. Bias u by a sin-of-v term so ridges curve gently (asymmetric crests).
//   3. Sample ridged noise (1 - |simplex|) at two scales with anisotropic u.
//      Aniso < 1 → features elongate in v (perpendicular to wind).
//   4. Add a low-frequency base undulation to break repetition.
function sampleHeight(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
): number {
  const cs = Math.cos(Tuning.DUNE_WIND_DIR_RAD);
  const sn = Math.sin(Tuning.DUNE_WIND_DIR_RAD);
  const u = x * cs + z * sn;       // along wind
  const v = -x * sn + z * cs;      // perpendicular to wind

  // Crest sawtooth bias — bows ridge crests along the wind axis.
  const uBias = Math.sin(v / Tuning.DUNE_RIDGE_SCALE_PRIMARY * Math.PI) *
                Tuning.DUNE_ASYMMETRY_AMOUNT;
  const uShifted = u + uBias;
  const aniso = Tuning.DUNE_ANISO_RATIO;

  // Primary ridges — the dominant dune wavelength.
  const r1 = 1 - Math.abs(noise(
    uShifted * aniso / Tuning.DUNE_RIDGE_SCALE_PRIMARY,
    v / Tuning.DUNE_RIDGE_SCALE_PRIMARY,
  ));
  // Secondary ripples riding on top of the primary ridges.
  const r2 = 1 - Math.abs(noise(
    uShifted * aniso / Tuning.DUNE_RIDGE_SCALE_SECONDARY,
    v / Tuning.DUNE_RIDGE_SCALE_SECONDARY,
  ));
  // Low-frequency drift so the world isn't a uniform grid of ridges.
  const base = noise(
    x / Tuning.DUNE_BASE_UNDULATION_SCALE,
    z / Tuning.DUNE_BASE_UNDULATION_SCALE,
  ) * Tuning.DUNE_BASE_UNDULATION_AMP;

  return r1 * Tuning.DUNE_PRIMARY_AMP +
         r2 * Tuning.DUNE_SECONDARY_AMP +
         base;
}
