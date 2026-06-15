// Dune terrain: layered simplex heightmap mesh + matching Rapier heightfield.
// Both share the same heights array — the visual mesh and the collider are
// generated from identical samples so they overlay exactly.
//
// Session EE — world rework #1. Replaced the single 800m heightfield with a
// GRID × GRID grid of CHUNK_SIZE-meter chunks (defaults: 3×3 × 800m =
// 2400m world span). Each chunk reuses the previous 192-cell pattern so
// per-chunk fidelity is unchanged. Seam invisibility: ALL chunks share one
// `createNoise2D` instance AND sample world-space (x, z) — adjacent chunks
// at their shared edge sample identical coords, producing bit-identical
// heights and zero visible seams.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { BiomeSampler } from './biomes.ts';
import { Tuning } from '../config/tuning.ts';
import { createTerrainMaterial } from './terrainMaterial.ts';

// Per-biome ground colors (Session P). Punchier than first-pass so the
// regions read clearly from a distance: dune = saturated orange-sand,
// rocky = dark red-brown, salt = bright warm-white.
const BIOME_COLOR_DUNE: readonly [number, number, number] = [0xcd / 255, 0x95 / 255, 0x55 / 255];
const BIOME_COLOR_ROCKY: readonly [number, number, number] = [0x55 / 255, 0x36 / 255, 0x1f / 255];
const BIOME_COLOR_SALT: readonly [number, number, number] = [0xf0 / 255, 0xe8 / 255, 0xd2 / 255];
// Cycle 8 (ACAQ) — wreck-yard graveyard ground: ashen oxidized grey-brown
// (rust-stained, drained of the warm dune orange). Reads as a different, dead place.
const BIOME_COLOR_WRECK_YARD: readonly [number, number, number] = [0x47 / 255, 0x3a / 255, 0x2e / 255];

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

const _BIOME_BLEND_WIDTH = 0.22;
function blendedBiomeColor(noiseVal: number): [number, number, number] {
  const rockyT = Tuning.BIOME_THRESHOLD_ROCKY;
  const saltT = Tuning.BIOME_THRESHOLD_SALT;
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

interface Chunk {
  /** World-space center of this chunk (Y = 0). */
  centerX: number;
  centerZ: number;
  /** Heights at each vertex, indexed [i*(CELLS+1)+j]. */
  heights: Float32Array;
}

export interface Terrain {
  /** One mesh per chunk; consumers iterate (e.g. for shadow flags). */
  meshes: THREE.Mesh[];
  /** Shared simplex-noise instance — exposed so the far-LOD ring + future
   *  procgen can sample identical world heights without seams. */
  noise: (x: number, y: number) => number;
  /** Bilinear sample of terrain height at world (x, z). 0 outside bounds. */
  heightAt: (x: number, z: number) => number;
  /** Approximate normal at world (x, z) using neighboring samples. */
  normalAt: (x: number, z: number) => THREE.Vector3;
  /** Half-extent of the playable square (world bounds = [-bound, +bound]). */
  worldHalfSize: number;
}

export function createTerrain(
  scene: THREE.Scene,
  world: RAPIER.World,
  rand: Rng,
  biomes: BiomeSampler,
): Terrain {
  const noise = createNoise2D(rand);

  const SIZE = Tuning.TERRAIN_CHUNK_SIZE;
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const GRID = Tuning.TERRAIN_CHUNK_GRID;
  const stride = CELLS + 1;
  const worldHalfSize = (SIZE * GRID) * 0.5;

  const chunks: Chunk[] = [];
  const meshes: THREE.Mesh[] = [];
  // Build one heightfield collider + one mesh per (gx, gz) chunk. Each
  // chunk's body is translated to the chunk's world-space center; vertices
  // in the mesh are mesh-local, also centered on (0, 0).
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      const centerX = (gx - (GRID - 1) * 0.5) * SIZE;
      const centerZ = (gz - (GRID - 1) * 0.5) * SIZE;

      const heights = new Float32Array(stride * stride);
      for (let i = 0; i <= CELLS; i++) {
        for (let j = 0; j <= CELLS; j++) {
          // World-space sampling — adjacent chunks' shared edge produces
          // identical heights because both chunks pass the same world (x,z)
          // through the SAME noise instance and biome sampler.
          const localX = (i / CELLS - 0.5) * SIZE;
          const localZ = (j / CELLS - 0.5) * SIZE;
          const x = centerX + localX;
          const z = centerZ + localZ;
          let flatness = biomeHeightScale(biomes.rawAt(x, z));
          const wyH = biomes.wreckYardAt(x, z);   // Cycle 8 — flatten the graveyard floor
          if (wyH > 0) flatness = flatness * (1 - wyH) + Tuning.WRECK_YARD_HEIGHT_SCALE * wyH;
          const pitH = biomes.sarlaccPitAt(x, z);  // ACAR — flatten a sand bowl around the maw
          if (pitH > 0) flatness = flatness * (1 - pitH) + 0.05 * pitH;
          heights[i * stride + j] = sampleHeight(noise, x, z) * flatness;
        }
      }

      // --- Three.js mesh (vertex positions in mesh-local space) ---
      const vertCount = stride * stride;
      const positions = new Float32Array(vertCount * 3);
      const colors = new Float32Array(vertCount * 3);
      // Per-vertex raw biome noise value — feeds the fragment shader's
      // biome-detection (terrainMaterial). Independent of vertex color
      // so the shader can detect biome correctly even where adjacent
      // vertices have blended colors.
      const biomeRaws = new Float32Array(vertCount);
      for (let i = 0; i <= CELLS; i++) {
        for (let j = 0; j <= CELLS; j++) {
          const idx = (i * stride + j) * 3;
          const localX = (i / CELLS - 0.5) * SIZE;
          const localZ = (j / CELLS - 0.5) * SIZE;
          positions[idx] = localX;
          positions[idx + 1] = heights[i * stride + j];
          positions[idx + 2] = localZ;
          const wx2 = centerX + localX, wz2 = centerZ + localZ;
          const n = biomes.rawAt(wx2, wz2);
          let c = blendedBiomeColor(n);
          const wyC = biomes.wreckYardAt(wx2, wz2);   // Cycle 8 — tint toward the graveyard ground
          if (wyC > 0) c = lerp3(c, BIOME_COLOR_WRECK_YARD, wyC);
          colors[idx]     = c[0];
          colors[idx + 1] = c[1];
          colors[idx + 2] = c[2];
          biomeRaws[i * stride + j] = n;
        }
      }
      const indices: number[] = [];
      for (let i = 0; i < CELLS; i++) {
        for (let j = 0; j < CELLS; j++) {
          const a = i * stride + j;
          const b = a + 1;
          const c = (i + 1) * stride + j;
          const d = c + 1;
          indices.push(a, b, c, b, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      // Custom per-vertex biome noise — read by terrainMaterial shader.
      geo.setAttribute('aBiomeRaw', new THREE.BufferAttribute(biomeRaws, 1));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      // Session MM-2 — procedural detail layer via onBeforeCompile shader
      // patches. Vertex colors (biome blend) feed the base diffuse, the
      // shader adds sand grain + wind ripples + slope-based darkening on
      // top. Zero bundle cost — no textures shipped.
      const mat = createTerrainMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(centerX, 0, centerZ);
      scene.add(mesh);

      // --- Rapier heightfield collider, body translated to chunk center ---
      const colliderDesc = RAPIER.ColliderDesc.heightfield(
        CELLS, CELLS, heights,
        { x: SIZE, y: 1, z: SIZE },
      );
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, 0, centerZ),
      );
      world.createCollider(colliderDesc, body);

      chunks.push({ centerX, centerZ, heights });
      meshes.push(mesh);
    }
  }

  // --- Sampling helpers ---
  // Index a chunk by world (x, z). Returns null if outside the playable area.
  const chunkAt = (x: number, z: number): Chunk | null => {
    const gx = Math.floor((x + worldHalfSize) / SIZE);
    const gz = Math.floor((z + worldHalfSize) / SIZE);
    if (gx < 0 || gx >= GRID || gz < 0 || gz >= GRID) return null;
    return chunks[gx * GRID + gz];
  };

  const heightAt = (x: number, z: number): number => {
    const chunk = chunkAt(x, z);
    if (!chunk) return 0;
    // Local coords within this chunk: [-SIZE/2, +SIZE/2] → [0, CELLS].
    const fi = ((x - chunk.centerX) / SIZE + 0.5) * CELLS;
    const fj = ((z - chunk.centerZ) / SIZE + 0.5) * CELLS;
    // Clamp to a safe interpolation range. fi can land on CELLS exactly at
    // the +X edge — that's the boundary shared with the next chunk; heights
    // there are identical so either chunk's sample matches.
    const i = Math.min(CELLS - 1, Math.max(0, Math.floor(fi)));
    const j = Math.min(CELLS - 1, Math.max(0, Math.floor(fj)));
    const tx = Math.min(1, Math.max(0, fi - i));
    const tz = Math.min(1, Math.max(0, fj - j));
    const h00 = chunk.heights[i * stride + j];
    const h10 = chunk.heights[(i + 1) * stride + j];
    const h01 = chunk.heights[i * stride + (j + 1)];
    const h11 = chunk.heights[(i + 1) * stride + (j + 1)];
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

  return { meshes, noise, heightAt, normalAt, worldHalfSize };
}

// Smooth wind-warped dunes. Long ridges run perpendicular to a prevailing
// wind direction, with rounded crests and rounded valleys — no sharp peaks.
function smoothRidge(n: number): number {
  return Math.cos(n * Math.PI * 0.5);
}

export function sampleHeight(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
): number {
  const cs = Math.cos(Tuning.DUNE_WIND_DIR_RAD);
  const sn = Math.sin(Tuning.DUNE_WIND_DIR_RAD);
  const u = x * cs + z * sn;       // along wind
  const v = -x * sn + z * cs;      // perpendicular to wind
  const aniso = Tuning.DUNE_ANISO_RATIO;

  const warp = noise(
    v / Tuning.DUNE_WARP_SCALE,
    u / Tuning.DUNE_WARP_SCALE,
  ) * Tuning.DUNE_ASYMMETRY_AMOUNT;
  const uShifted = u + warp;

  const np = noise(
    uShifted * aniso / Tuning.DUNE_RIDGE_SCALE_PRIMARY,
    v / Tuning.DUNE_RIDGE_SCALE_PRIMARY,
  );
  const r1 = smoothRidge(np);

  const ns = noise(
    uShifted * aniso / Tuning.DUNE_RIDGE_SCALE_SECONDARY,
    v / Tuning.DUNE_RIDGE_SCALE_SECONDARY,
  );
  const r2 = smoothRidge(ns);

  const base = noise(
    x / Tuning.DUNE_BASE_UNDULATION_SCALE,
    z / Tuning.DUNE_BASE_UNDULATION_SCALE,
  ) * Tuning.DUNE_BASE_UNDULATION_AMP;

  return r1 * Tuning.DUNE_PRIMARY_AMP +
         r2 * Tuning.DUNE_SECONDARY_AMP +
         base;
}

// Re-export so the far-LOD ring can use the same biome height scaling as
// the chunks (without it the LOD's salt regions would tower above the
// chunks' near-flat salt).
export { biomeHeightScale };
