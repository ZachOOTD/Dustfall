// Dune terrain: layered simplex heightmap mesh + matching Rapier heightfield.
// Both share the same heights array — the visual mesh and the collider are
// generated from identical samples so they overlay exactly.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';

const SIZE = 800;   // world units across the square terrain
const CELLS = 128;  // cells per side; vertices = (CELLS+1)^2

// Octave amplitudes & scales tuned for a Sahara/Dune dune look.
const OCTAVES: ReadonlyArray<readonly [number, number]> = [
  [80, 6.5],   // large dunes
  [25, 1.6],   // mid ridges
  [6, 0.35],   // grain
];

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
): Terrain {
  const noise = createNoise2D(rand);

  const heights = new Float32Array((CELLS + 1) * (CELLS + 1));
  for (let i = 0; i <= CELLS; i++) {
    for (let j = 0; j <= CELLS; j++) {
      const x = (i / CELLS - 0.5) * SIZE;
      const z = (j / CELLS - 0.5) * SIZE;
      heights[i * (CELLS + 1) + j] = sampleHeight(noise, x, z);
    }
  }

  // --- Three.js mesh ---
  const positions = new Float32Array((CELLS + 1) * (CELLS + 1) * 3);
  for (let i = 0; i <= CELLS; i++) {
    for (let j = 0; j <= CELLS; j++) {
      const idx = (i * (CELLS + 1) + j) * 3;
      positions[idx] = (i / CELLS - 0.5) * SIZE;
      positions[idx + 1] = heights[i * (CELLS + 1) + j];
      positions[idx + 2] = (j / CELLS - 0.5) * SIZE;
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
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: 0xb8915a });
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

function sampleHeight(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
): number {
  let h = 0;
  for (const [scale, amp] of OCTAVES) {
    h += noise(x / scale, z / scale) * amp;
  }
  return h;
}
