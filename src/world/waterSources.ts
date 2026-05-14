// World water sources — abandoned wells, scattered with a salt-biome quota.
// The player aims at one and presses E with a non-full canteen to refill.
//
// Registered in `ctx.waterSources.list`. Tagged via userData.interactType/Id
// so the interaction raycast finds them.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { BiomeSampler } from './biomes.ts';
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
const _stoneMatLight = new THREE.MeshLambertMaterial({
  color: Tuning.WELL_STONE_LIGHT_HEX,
  flatShading: true,
});
const _stoneMatDark = new THREE.MeshLambertMaterial({
  color: Tuning.WELL_STONE_DARK_HEX,
  flatShading: true,
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
  // Ring of irregular stones — perturbed icosahedra at slight scale + height
  // variation so the circle reads as hand-stacked rocks, not a precise build.
  for (let i = 0; i < stoneCount; i++) {
    const baseAng = (i / stoneCount) * Math.PI * 2;
    // Small angular + radial jitter so stones don't perfectly tile.
    const ang = baseAng + (rand() - 0.5) * 0.18;
    const r = ringR * (0.94 + rand() * 0.12);
    const sz = Tuning.WELL_STONE_SIZE * (0.78 + rand() * 0.34);
    const geo = new THREE.IcosahedronGeometry(sz, 0);
    perturbOutward(geo, 0.22, 31 + i * 7);
    const mat = rand() < 0.5 ? _stoneMatLight : _stoneMatDark;
    const stone = new THREE.Mesh(geo, mat);
    stone.position.set(Math.cos(ang) * r, sz * 0.55, Math.sin(ang) * r);
    stone.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    // Squash slightly so stones look set into the ground rather than ball-like.
    stone.scale.y = 0.78 + rand() * 0.12;
    g.add(stone);
  }
  // Dark inner hole — set BELOW the hatch so peeks-through-the-cracks reads dark.
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(ringR * 0.72, 18),
    _holeMat,
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = Tuning.WELL_STONE_SIZE * 0.35;
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
  // Place the hatch sitting on top of the stone ring, slightly slid off-center
  // so part of the well opening is visible (peek into the dark).
  const slideAng = rand() * Math.PI * 2;
  const slideDist = ringR * 0.18;
  hatch.position.set(
    Math.cos(slideAng) * slideDist,
    Tuning.WELL_STONE_SIZE * 1.05,
    Math.sin(slideAng) * slideDist,
  );
  hatch.rotation.y = slideAng + Math.PI / 2 + (rand() - 0.5) * 0.3;
  // Tip the hatch up a tiny bit on one side for "askew" feel.
  hatch.rotation.x = (rand() - 0.5) * 0.08;
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
  // Session Z — wells restricted to salt-flats biome (dried lakebed geology
  // is where the player's mental model expects a dug well). Wells that can't
  // find a salt patch within MAX_ATTEMPTS are silently dropped — better to
  // ship 3 wells in salt than to scatter strays into dunes/rocky.
  const TARGET_WELLS = Tuning.WELL_TARGET_COUNT;
  const MAX_ATTEMPTS = 80;

  for (let i = 0; i < TARGET_WELLS; i++) {
    let x = 0, z = 0;
    let placed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const radius = 35 + rand() * 200;
      const angle = rand() * Math.PI * 2;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      if (biomes.biomeAt(cx, cz) === 'salt') {
        x = cx; z = cz; placed = true; break;
      }
    }
    if (!placed) continue; // no salt within budget — skip this well

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

