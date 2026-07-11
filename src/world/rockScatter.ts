// Rock scatter (Session OO-4) — scattered ground rocks across the
// rocky biome. Replaces the procedural-fissure shader on rocky
// terrain (which read too similarly to the salt-flat desiccation
// cracks) with actual geometry that reads as rocky-strewn ground.
//
// Pattern lifted from titleScene.ts's silhouette rocks: small
// IcosahedronGeometry primitives with random scale + rotation + a
// slight Y-flatten so they sit on the ground rather than perched on
// their points. Two size tiers — small pebbles (~0.15-0.4m) and
// medium rocks (~0.5-1.2m) — placed via the same per-biome rejection-
// sample pattern that deadTree.ts / cactus.ts use.
//
// No physics colliders. These are visual props — players can walk
// through them. The silhouette is what matters; colliding on every
// pebble would be expensive and feel sticky.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { createStoneMaterial } from './stoneMaterial.ts';
import type { BiomeSampler } from './biomes.ts';

// Two grey-brown rock palettes for variety. Sharing one material per
// size tier keeps draw-call count low. ABH — both tiers get the
// procedural stone shader (aggregate grain + cracks + dust-on-top
// per world-up normal + sun-bleach). The dust color matches the
// surrounding dune sand so rocks integrate visually with the biome.
const _rockSmallMat = createStoneMaterial(0x4a3a2a, {
  dustColor: 0xb89870,
  dustStrength: 0.7,
  crackDensity: 0.5,
});
const _rockMediumMat = createStoneMaterial(0x554635, {
  dustColor: 0xb89870,
  dustStrength: 0.6,
  crackDensity: 0.5,
});

const TARGET_COUNT = 520;          // total rock count across rocky biome
const MEDIUM_FRACTION = 0.32;      // ~32% medium-size, rest pebble
const MAX_PLACEMENT_TRIES = TARGET_COUNT * 25;
const WORLD_RADIUS = 1100;         // matches DEAD_TREE_SCATTER_RADIUS_MAX
const RADIUS_MIN = 30;             // skip the area right around spawn

/** Infinite Sands S3 — build ONE scatter rock at (x, z), drawing its
 *  tier/size/pose from the passed rng (6 draws, fixed budget). Used by the
 *  chunk streamer with a per-chunk rng; NOT added to the scene (the caller
 *  parents it into its chunk group). The boot loop below intentionally does
 *  NOT route through this — its inline draws feed the shared boot stream
 *  whose exact order every creature id depends on (D208/D294). */
export function makeScatterRock(terrain: Terrain, x: number, z: number, rand: Rng): THREE.Mesh {
  const isMedium = rand() < MEDIUM_FRACTION;
  const baseR = isMedium
    ? 0.5 + rand() * 0.7      // 0.5 - 1.2m
    : 0.15 + rand() * 0.25;   // 0.15 - 0.4m
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(baseR, 0),
    isMedium ? _rockMediumMat : _rockSmallMat,
  );
  rock.position.set(x, terrain.heightAt(x, z) + baseR * 0.15, z);
  rock.rotation.set(rand() * 0.8, rand() * Math.PI * 2, rand() * 0.6);
  rock.scale.set(1.0, 0.55 + rand() * 0.30, 1.0);
  rock.castShadow = isMedium;
  rock.receiveShadow = true;
  return rock;
}

/** Spawn rocks across the rocky biome. Rejection-sample until either
 *  TARGET_COUNT rocks are placed or MAX_PLACEMENT_TRIES is hit. */
export function spawnRockScatter(
  scene: THREE.Scene,
  terrain: Terrain,
  biomes: BiomeSampler,
  rand: Rng,
): THREE.Mesh[] {
  const rocks: THREE.Mesh[] = [];
  const radiusSpan = WORLD_RADIUS - RADIUS_MIN;

  for (let tries = 0; tries < MAX_PLACEMENT_TRIES && rocks.length < TARGET_COUNT; tries++) {
    // Uniform-disc sampling: r = sqrt(rand) * RMAX so we don't cluster
    // density toward the origin.
    const r = RADIUS_MIN + Math.sqrt(rand()) * radiusSpan;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;

    // Rocky biome only.
    if (biomes.biomeAt(x, z) !== 'rocky') continue;

    const isMedium = rand() < MEDIUM_FRACTION;
    const baseR = isMedium
      ? 0.5 + rand() * 0.7      // 0.5 - 1.2m
      : 0.15 + rand() * 0.25;   // 0.15 - 0.4m
    const mat = isMedium ? _rockMediumMat : _rockSmallMat;

    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(baseR, 0),
      mat,
    );
    const groundY = terrain.heightAt(x, z);
    // Sink slightly so the rock sits on the ground rather than
    // hovering on a single vertex.
    rock.position.set(x, groundY + baseR * 0.15, z);
    rock.rotation.set(
      rand() * 0.8,
      rand() * Math.PI * 2,
      rand() * 0.6,
    );
    // Flatten Y so the rock reads as resting on its widest face,
    // not perched on a point.
    rock.scale.set(1.0, 0.55 + rand() * 0.30, 1.0);
    rock.castShadow = isMedium;     // only medium rocks cast shadows (perf)
    rock.receiveShadow = true;
    scene.add(rock);
    rocks.push(rock);
  }

  return rocks;
}
