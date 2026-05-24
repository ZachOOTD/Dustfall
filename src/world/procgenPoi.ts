// Procgen POI placement (Session HH — world rework #3). Augments the 6
// hand-placed anchor POIs in `poi.ts` with ~15 wrecks scattered across
// the chunk band. Uses simple rejection sampling with min-separation
// enforcement against all anchor POIs + already-placed procgen POIs —
// Poisson-disk character at this density (~15 POIs over ~4M m² of
// playable area).
//
// Wreck kinds drawn from the existing vocabulary in `wrecks.ts` so this
// ships without any new art. Each procgen POI registers as a salvageable
// so it has an interactable affordance like the anchor wrecks.
//
// Determinism: a single shared `rand` stream drives all sampling, so
// the same seed produces the same procgen POI list across reloads.
// id assignment is therefore stable, which keeps save persistence safe
// (per D55 — id-based scatter persistence absorbs count growth).

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeSampler } from './biomes.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { placeWreck, type WreckKind } from './wrecks.ts';
import { placeProcgenComposite } from './procgenWreck.ts';
import { Tuning } from '../config/tuning.ts';

// Wreck-kind palette for procgen POIs. Cargo containers are intentionally
// excluded — the anchor POIs don't use them either, and they read more
// like ground props than hero silhouettes. JJ — 'antenna_spire' dropped
// too (per backlog "remove antenna tower landmarks"). The hand-placed
// `antenna_outpost` anchor POI is the only remaining antenna spire.
const PROCGEN_WRECK_KINDS: ReadonlyArray<WreckKind> = [
  'engine_bell',
  'fuselage',
  'escape_pod',
  'engine_cluster',
];

export function placeProcgenPOIs(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
  anchorPositions: ReadonlyArray<{ x: number; z: number }>,
  biomes: BiomeSampler,
): THREE.Vector3[] {
  const placed: THREE.Vector3[] = [];
  const minSep = Tuning.POI_MIN_SEPARATION;
  const minSepSq = minSep * minSep;
  const rMin = Tuning.POI_SCATTER_RADIUS_MIN;
  const rMax = Tuning.POI_SCATTER_RADIUS_MAX;
  const target = Tuning.POI_PROCGEN_COUNT;
  const maxTries = Tuning.POI_MAX_PLACEMENT_TRIES;
  // AAI — player-spawn exclusion: procgen wrecks (smaller than flagships
  // but still tall props) shouldn't crowd the opening cinematic. Uses the
  // same anchor + radius as the flagship sampler.
  const spawnX = Tuning.OPENING_SCENE_ANCHOR_X;
  const spawnZ = Tuning.OPENING_SCENE_ANCHOR_Z;
  const spawnExcludeSq = Tuning.PLAYER_SPAWN_EXCLUSION_RADIUS * Tuning.PLAYER_SPAWN_EXCLUSION_RADIUS;

  // Combined exclusion list — anchors are fixed obstacles, accepted
  // procgen POIs become obstacles for subsequent picks.
  const allCenters: Array<{ x: number; z: number }> = [
    ...anchorPositions.map((p) => ({ x: p.x, z: p.z })),
  ];

  for (let i = 0; i < target; i++) {
    let accepted: { x: number; z: number } | null = null;
    for (let t = 0; t < maxTries; t++) {
      const r = rMin + rand() * (rMax - rMin);
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // AAI — spawn-zone exclusion (per D83).
      const sdx = x - spawnX, sdz = z - spawnZ;
      if (sdx * sdx + sdz * sdz < spawnExcludeSq) continue;
      let blocked = false;
      for (const c of allCenters) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < minSepSq) { blocked = true; break; }
      }
      if (!blocked) { accepted = { x, z }; break; }
    }
    if (!accepted) break;  // world saturated — stop early
    allCenters.push(accepted);

    const y = terrain.heightAt(accepted.x, accepted.z);
    const pos = new THREE.Vector3(accepted.x, y, accepted.z);
    // Session ABA — split procgen wrecks between hand-modeled (legacy
    // ~65%) and composite (new procgen system ~35%). The composite
    // wrecks come from `placeProcgenComposite` in `procgenWreck.ts`
    // which assembles 3-9 parts from a part vocabulary (cockpit +
    // hullSegment + engineModule + tailStub) per-seed for ~100s of
    // unique silhouettes vs. the legacy 4-kind palette. Composite
    // wrecks register their own salvageables internally.
    if (rand() < Tuning.PROCGEN_COMPOSITE_SHARE) {
      const buryY = 0.3 + rand() * 0.4;
      // ABJ — B4: thread the biome at the placement position so the
      // composite assembler can bias hullSegment variant selection.
      const biome = biomes.biomeAt(accepted.x, accepted.z);
      placeProcgenComposite(scene, world, terrain, pos, rand, salvageables, { buryY, biome });
    } else {
      const kind = PROCGEN_WRECK_KINDS[Math.floor(rand() * PROCGEN_WRECK_KINDS.length)];
      // Modest size + bury variation so procgen POIs read as varied silhouettes
      // but stay smaller than the hero anchors (mega-ship / mega-wreck).
      const scale = 0.9 + rand() * 0.5;
      const buryY = 0.3 + rand() * 0.6;
      const tiltZ = (rand() - 0.5) * 0.25;
      const group = placeWreck(scene, world, terrain, pos, kind, rand, {
        scale, buryY, tiltZ,
      });
      if (salvageables) {
        // Use the wreck kind directly — registerSalvageable accepts the
        // same union as placeWreck.
        registerSalvageable(salvageables, group, kind, pos, rand);
      }
    }
    placed.push(pos);
  }

  return placed;
}
