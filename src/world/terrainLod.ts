// Far-LOD terrain ring (Session EE — world rework #1). A single coarse
// square mesh covering [-OUTER, +OUTER] on each axis, sampling the SAME
// noise instance as the chunk band so heights match where the two
// overlap. No collider — the LOD is visual-only and the player can't
// reach it (it sits outside the chunk band's playable area).
//
// Overlap strategy: rather than carve a donut hole, the mesh sits at
// y = -LOD_BIAS_Y so the high-detail chunk meshes always win the
// z-buffer fight within the chunk band. The bias is tiny enough to be
// invisible at LOD viewing distances (>1200m from camera, heavy fog).
//
// Material: uniform dune-sand color. Biome tinting is skipped at this
// distance — fog density 0.0018 swallows fine color variation past 1km.

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';
import { sampleHeight, biomeHeightScale } from './terrain.ts';
import type { BiomeSampler } from './biomes.ts';

const LOD_COLOR_HEX = 0xb88860;  // muted desert sand, slightly cooler than dune mid-tone
const LOD_BIAS_Y = -0.15;        // meters — slot under chunks to avoid z-fight

export function createTerrainLod(
  scene: THREE.Scene,
  noise: (x: number, y: number) => number,
  biomes: BiomeSampler,
): THREE.Mesh {
  const OUTER = Tuning.TERRAIN_LOD_OUTER_RADIUS;
  const CELLS = Tuning.TERRAIN_LOD_CELLS;
  const stride = CELLS + 1;
  const SPAN = OUTER * 2;

  const positions = new Float32Array(stride * stride * 3);
  for (let i = 0; i <= CELLS; i++) {
    for (let j = 0; j <= CELLS; j++) {
      const idx = (i * stride + j) * 3;
      const x = (i / CELLS - 0.5) * SPAN;
      const z = (j / CELLS - 0.5) * SPAN;
      // Same noise + biome scaling the chunk band uses — vertices at chunk
      // boundary coords coincide with chunk-band heights exactly.
      const flatness = biomeHeightScale(biomes.rawAt(x, z));
      positions[idx] = x;
      positions[idx + 1] = sampleHeight(noise, x, z) * flatness;
      positions[idx + 2] = z;
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
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: LOD_COLOR_HEX });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = LOD_BIAS_Y;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // The LOD is far enough away that landmarks etc. won't write shadows
  // onto it. Mark it as far-from-origin so the shadow-flag walk in main
  // doesn't reconsider.
  mesh.userData.farFromOrigin = true;
  scene.add(mesh);
  return mesh;
}
