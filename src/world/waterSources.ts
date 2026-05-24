// World water sources — abandoned wells, scattered with a salt-biome quota.
// The player aims at one and presses E with a non-full canteen to refill.
//
// Registered in `ctx.waterSources.list`. Tagged via userData.interactType/Id
// so the interaction raycast finds them.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { BiomeSampler } from './biomes.ts';
import { createStoneMaterial } from './stoneMaterial.ts';
import { findBiomeCentroid } from './biomes.ts';
import { perturbOutward } from './sculpt.ts';
import { Tuning } from '../config/tuning.ts';

export type WaterSourceKind = 'well';

export interface WaterSource {
  id: number;
  kind: WaterSourceKind;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  hovered: boolean;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'refill';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'waterSources';
  });
}

// Shared materials — instances reused across all wells.
// ABH — well rim stones get the procedural stone shader (aggregate +
// cracks + dust accumulation on top-facing surfaces, which fits the
// well-stone topology where each ring stone has a flat top exposed to
// settling sand from the salt-flat surroundings).
const _stoneMatLight = createStoneMaterial(Tuning.WELL_STONE_LIGHT_HEX, {
  dustColor: 0xe0c89a,
  dustStrength: 0.75,
  crackDensity: 0.3,
});
const _stoneMatDark = createStoneMaterial(Tuning.WELL_STONE_DARK_HEX, {
  dustColor: 0xe0c89a,
  dustStrength: 0.75,
  crackDensity: 0.4,
});
const _woodMat = new THREE.MeshLambertMaterial({
  color: Tuning.WELL_WOOD_HEX,
  flatShading: true,
});
const _woodMatDark = new THREE.MeshLambertMaterial({
  color: Tuning.WELL_WOOD_DARK_HEX,
  flatShading: true,
});
const _holeMat = new THREE.MeshBasicMaterial({ color: 0x05080a });

function makeWell(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const ringR = Tuning.WELL_RING_RADIUS;
  const stoneCount = Tuning.WELL_STONE_COUNT;
  const rings = Tuning.WELL_STONE_RINGS;
  const baseSize = Tuning.WELL_STONE_SIZE;
  // CC-4 — three stacked rings of stones (was one) so the well reads as a
  // chest-height structure visible from across the salt flats. Each ring
  // sits about one stone-RADIUS above the one below it (was one full
  // stone-DIAMETER), so adjacent rings overlap by ~half a stone height
  // and the stack reads as dense interlocking masonry rather than three
  // discrete bands with gaps. Small angular phase offset prevents column
  // stacking.
  const ringSpacing = baseSize * 0.85;
  for (let ring = 0; ring < rings; ring++) {
    const yOffset = baseSize * 0.55 + ring * ringSpacing;
    const ringPhaseOffset = ring * (Math.PI / stoneCount); // alternate-row stagger
    for (let i = 0; i < stoneCount; i++) {
      const baseAng = (i / stoneCount) * Math.PI * 2 + ringPhaseOffset;
      const ang = baseAng + (rand() - 0.5) * 0.18;
      const r = ringR * (0.94 + rand() * 0.12);
      const sz = baseSize * (0.78 + rand() * 0.34);
      const geo = new THREE.IcosahedronGeometry(sz, 0);
      perturbOutward(geo, 0.22, 31 + i * 7 + ring * 113);
      const mat = rand() < 0.5 ? _stoneMatLight : _stoneMatDark;
      const stone = new THREE.Mesh(geo, mat);
      stone.position.set(Math.cos(ang) * r, yOffset, Math.sin(ang) * r);
      stone.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      stone.scale.y = 0.78 + rand() * 0.12;
      g.add(stone);
    }
  }
  // Dark inner hole — set just below the top ring so peeks-through-the-cracks
  // read as a deep shaft going down into the well.
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(ringR * 0.72, 18),
    _holeMat,
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = baseSize * 0.55 + (rings - 1) * ringSpacing + 0.05;
  g.add(hole);

  // Wooden hatch — a small plank set across the well opening, slightly off-center
  // so it reads as "pushed aside." Five narrow planks make up the slab.
  const hatch = new THREE.Group();
  const plankLen = ringR * 1.7;
  const plankCount = Tuning.WELL_HATCH_PLANK_COUNT;
  const plankW = (ringR * 1.5) / plankCount;
  const plankH = Tuning.WELL_HATCH_THICKNESS;
  for (let i = 0; i < plankCount; i++) {
    const px = (i - (plankCount - 1) / 2) * plankW * 1.02;
    const mat = (i + Math.floor(rand() * 2)) % 2 === 0 ? _woodMat : _woodMatDark;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankW * 0.98, plankH, plankLen),
      mat,
    );
    plank.position.set(px, 0, 0);
    hatch.add(plank);
  }
  // Cross-brace — narrow strip across the planks, perpendicular
  const brace = new THREE.Mesh(
    new THREE.BoxGeometry(ringR * 1.5, plankH * 1.2, plankH * 1.6),
    _woodMatDark,
  );
  brace.position.set(0, plankH * 0.5, plankLen * 0.28);
  hatch.add(brace);
  // Place the hatch sitting on top of the TOP stone ring, slightly slid
  // off-center so part of the well opening is visible (peek into the dark).
  // CC-4 — sit the hatch at the MIN stone-top height (≈ radius × min
  // scale.y) instead of the average. Smallest stones now bear the plank
  // on all corners, larger stones poke up through it (which is what
  // hand-stacked masonry does — uneven tops, planks settle askew).
  // Tilt randomization on BOTH pitch + roll widened so the plank reads as
  // "wedged in askew" rather than "perfectly flat with daylight under
  // half the corners".
  const slideAng = rand() * Math.PI * 2;
  const slideDist = ringR * 0.18;
  const topRingY = baseSize * 0.55 + (rings - 1) * ringSpacing;
  const stoneMinHalfHeight = baseSize * 0.61;  // ≈ radius_min × scale.y_min
  hatch.position.set(
    Math.cos(slideAng) * slideDist,
    topRingY + stoneMinHalfHeight + Tuning.WELL_HATCH_THICKNESS * 0.5,
    Math.sin(slideAng) * slideDist,
  );
  hatch.rotation.y = slideAng + Math.PI / 2 + (rand() - 0.5) * 0.3;
  // Pitch + roll tilt — both ±~6° so the plank looks settled into the
  // uneven stone tops on all four corners.
  hatch.rotation.x = (rand() - 0.5) * 0.22;
  hatch.rotation.z = (rand() - 0.5) * 0.16;
  g.add(hatch);

  return g;
}

export function spawnWaterSources(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  biomes: BiomeSampler,
): WaterSource[] {
  const list: WaterSource[] = [];
  // GG — multi-well across the larger 2400m world. Greedy salt-centroid
  // search: pick the deepest-salt cell, mark a WELL_MIN_SEPARATION
  // exclusion around it, then find the next-best cell outside the
  // exclusion. Wells naturally land in separate salt regions instead of
  // clustering. If the world ever runs out of un-excluded salt, we stop
  // early (loop returns null centroid).
  const TARGET_WELLS = Tuning.WELL_TARGET_COUNT;
  const centers: Array<{ x: number; z: number; radius: number }> = [];

  for (let i = 0; i < TARGET_WELLS; i++) {
    const center = findBiomeCentroid(biomes, 'salt', { excludeCenters: centers });
    if (!center) break; // no more salt region — stop early
    centers.push({ x: center.x, z: center.z, radius: Tuning.WELL_MIN_SEPARATION });

    const x = center.x;
    const z = center.z;
    const groundY = terrain.heightAt(x, z);
    const mesh = makeWell(rand);
    // Sink the well slightly so its stone base sits flush even on a slope.
    mesh.position.set(x, groundY - 0.05, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });

    const id = _nextId++;
    tag(mesh, id);
    scene.add(mesh);
    list.push({
      id,
      kind: 'well',
      mesh,
      pos: new THREE.Vector3(x, groundY, z),
      hovered: false,
    });
  }
  return list;
}

export function findWaterSourceById(list: WaterSource[], id: number | undefined): WaterSource | null {
  if (id === undefined) return null;
  for (const w of list) if (w.id === id) return w;
  return null;
}

