// "Hero" landmarks — rare, hand-placed scavenger-fantasy ship wrecks that
// punctuate the desert. Roughly 1 every 100m of world radius. Stable seed
// positions so the player can learn the map.
//
// Session S re-themed this entirely: the old ribcage / obelisk / radio-tower
// types are gone. Hero spots now pick from the sci-fi wreck registry.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { placeWreck, type WreckKind } from './wrecks.ts';

// Smaller / mid-sized wreck types make for ambient hero landmarks. The
// MASSIVE half-buried hulls live in poi.ts as hand-placed focal points.
const HERO_WRECK_TYPES: ReadonlyArray<WreckKind> = [
  'engine_cluster',
  'fuselage',
  'escape_pod',
  'cargo_container',
  'antenna_spire',
  'engine_bell',
];

export function placeHeroLandmarks(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
): void {
  const count = 7 + Math.floor(rand() * 3); // 7-9
  for (let i = 0; i < count; i++) {
    // Spread around a ring; jitter angle + radius for variety.
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.8;
    const radius = 70 + rand() * 180;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);
    const kind = HERO_WRECK_TYPES[Math.floor(rand() * HERO_WRECK_TYPES.length)];
    placeWreck(scene, world, terrain, new THREE.Vector3(x, y, z), kind, rand, {
      scale: kind === 'antenna_spire' ? 1.0 : 0.9 + rand() * 0.3,
    });
  }
}
