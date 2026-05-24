// Rocky subterranean entrance POI (Session ABK — A4 continuation).
//
// Third of the biome-specific POI family (ABJ shipped dune buried
// cockpit, ABK adds salt outpost + this). Placed at rocky-biome
// centroids. Reads as "natural cave system someone modified — stairs
// carved into the floor, a small sheltered chamber at the bottom."
//
// Composition:
//   - Rocky outcrop on the surface — 6-8 lumpy stone boulders forming
//     a hill ~4m tall (icosahedron + box mix).
//   - Cave-mouth opening — dark archway carved into the outcrop's +Z
//     face. Inner darkness suggests the descending passage.
//   - Descending stairs — 4 stone steps going DOWN from the cave mouth
//     into the buried chamber (each step ~0.4m drop).
//   - Interior chamber — ~4×3×2.5m box, rendered with BackSide stone
//     material so the cavity interior is visible from inside. Floor +
//     walls + low ceiling.
//   - Shelter zone — full enclosure (not large-tent partial). Inside
//     the chamber, storms can't reach the player.
//   - Salvage panel — 'escape_pod' palette (medical-leaning loot;
//     "the researcher kept their medkit down here").
//
// Placement: 1 per rocky-biome region via findBiomeCentroid + greedy
// multi-region exclusion (same pattern as ABJ buried cockpit).

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeSampler } from './biomes.ts';
import { findBiomeCentroid } from './biomes.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import type { ShelterRegistry } from '../shelter/shelterZones.ts';
import { addShelterZone } from '../shelter/shelterZones.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';
import { Tuning } from '../config/tuning.ts';
import { createStoneMaterial } from './stoneMaterial.ts';
import { addAccessPanel } from './wrecks.ts';

// Outcrop stone — dark grey, heavy crack network, low dust (it's rocky
// biome, sand doesn't accumulate on the boulders).
const _outcropMat = createStoneMaterial(0x5e5550, {
  crackDensity: 0.65,
  dustStrength: 0.2,
});
// Stair stone — slightly lighter, simulates worn footfall surface.
const _stairMat = createStoneMaterial(0x6e6560, {
  crackDensity: 0.45,
  dustStrength: 0.35,
});
// Interior cavity stone — darker, BackSide rendering so player inside
// sees the cavity walls. Renders inside-only so the box doesn't
// occlude the cave mouth opening from outside.
const _interiorMat = createStoneMaterial(0x383230, {
  crackDensity: 0.55,
  dustStrength: 0.4,
  doubleSide: false,
});
// Force BackSide on the interior material. createStoneMaterial returns
// MeshLambertMaterial; we override side directly per ABG pattern.
_interiorMat.side = THREE.BackSide;
_interiorMat.shadowSide = THREE.FrontSide;

/** Geometry constants — used for both visual + shelter-zone sizing. */
const CHAMBER_W = 4.0;          // chamber X extent
const CHAMBER_H = 2.5;          // chamber Y extent (ceiling height)
const CHAMBER_D = 3.0;          // chamber Z extent
const CHAMBER_DEPTH = 2.0;      // how far chamber center sits BELOW the surface
const STAIR_COUNT = 4;
const STAIR_DROP_PER_STEP = CHAMBER_DEPTH / STAIR_COUNT;
const STAIR_TREAD_DEPTH = 0.55;
const STAIR_WIDTH = 1.6;

/** Place a rocky subterranean entrance at the given world position.
 *  Returns the placed group. The interior chamber center sits at
 *  pos.y - CHAMBER_DEPTH + CHAMBER_H/2 in world Y. */
export function placeRockyEntrance(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
  shelter: ShelterRegistry | undefined,
): THREE.Group {
  const root = new THREE.Group();
  root.position.copy(pos);

  // ── 1. Rocky outcrop on the surface ─────────────────────────────────
  // 6-8 lumpy boulders forming a mound. Cave mouth faces +Z; cluster
  // boulders behind (-Z half) and to the sides so the mouth opens onto
  // an accessible front.
  const boulderCount = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < boulderCount; i++) {
    // Cluster bias: most boulders to -Z side, a few flanking
    const angleBase = i / boulderCount * Math.PI * 2;
    const angle = angleBase + (rand() - 0.5) * 0.5;
    // Bias z negative (behind cave mouth)
    let r = 2.0 + rand() * 1.6;
    let bx = Math.cos(angle) * r;
    let bz = Math.sin(angle) * r - 0.5;          // bias backward
    // Skip boulders that would clip the cave-mouth opening
    if (Math.abs(bx) < STAIR_WIDTH * 0.5 + 0.3 && bz > 0) {
      bz -= 1.5;                                  // push behind
    }
    const sz = 1.2 + rand() * 0.9;
    const geo = (rand() < 0.6)
      ? new THREE.IcosahedronGeometry(sz * 0.55, 1)
      : new THREE.BoxGeometry(sz, sz * 0.8, sz);
    const boulder = new THREE.Mesh(geo, _outcropMat);
    boulder.position.set(bx, sz * 0.3, bz);     // half-buried
    boulder.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    root.add(boulder);
  }

  // ── 2. Cave-mouth arch — frame on +Z face of the outcrop. ───────────
  // The frame is 3 stone blocks: 2 verticals + 1 lintel. Reads as
  // "entrance someone reinforced."
  const archYBase = 0.0;                                // ground level
  const archH = 1.9;
  const archInnerW = STAIR_WIDTH;
  const archInnerH = archH;
  // Left vertical
  const archL = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, archH, 0.45),
    _outcropMat,
  );
  archL.position.set(-archInnerW / 2 - 0.15, archYBase + archH / 2, 0.9);
  root.add(archL);
  // Right vertical
  const archR = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, archH, 0.45),
    _outcropMat,
  );
  archR.position.set(archInnerW / 2 + 0.15, archYBase + archH / 2, 0.9);
  root.add(archR);
  // Lintel
  const archTop = new THREE.Mesh(
    new THREE.BoxGeometry(archInnerW + 0.6, 0.35, 0.45),
    _outcropMat,
  );
  archTop.position.set(0, archYBase + archInnerH + 0.175, 0.9);
  root.add(archTop);

  // ── 3. Descending stairs — from cave mouth into chamber. ────────────
  // First step at the cave mouth Y=0, each step drops STAIR_DROP_PER_STEP.
  // Stairs go in -Z direction (away from cave mouth, INTO the outcrop).
  for (let i = 0; i < STAIR_COUNT; i++) {
    const y = -STAIR_DROP_PER_STEP * (i + 1);
    const z = 0.7 - STAIR_TREAD_DEPTH * (i + 1);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(STAIR_WIDTH, STAIR_DROP_PER_STEP * 1.1, STAIR_TREAD_DEPTH),
      _stairMat,
    );
    step.position.set(0, y + STAIR_DROP_PER_STEP * 0.5, z);
    step.castShadow = true;
    step.receiveShadow = true;
    root.add(step);
  }

  // ── 4. Interior chamber — sunken cavity, BackSide stone walls. ──────
  // Chamber center sits at Y = -CHAMBER_DEPTH (below outcrop surface),
  // shifted -Z so it's behind the cave mouth. The box geometry is
  // rendered with BackSide so the player INSIDE sees the cavity walls
  // (per ABG salvage-panel pattern). Outside, the chamber box is
  // invisible (the player sees the surface boulders instead).
  const chamberY = -CHAMBER_DEPTH;
  const chamberCenterZ = -STAIR_TREAD_DEPTH * STAIR_COUNT - CHAMBER_D / 2 + 0.8;
  const chamber = new THREE.Mesh(
    new THREE.BoxGeometry(CHAMBER_W, CHAMBER_H, CHAMBER_D),
    _interiorMat,
  );
  chamber.position.set(0, chamberY + CHAMBER_H / 2 - CHAMBER_H / 2, chamberCenterZ);
  // No collider on the chamber visual itself; we'll add ground + walls
  // as separate solid colliders so the player can walk inside.
  chamber.userData.noCollider = true;
  root.add(chamber);

  // Solid floor of the chamber (FrontSide flat).
  const chamberFloor = new THREE.Mesh(
    new THREE.BoxGeometry(CHAMBER_W * 0.95, 0.20, CHAMBER_D * 0.95),
    _stairMat,
  );
  chamberFloor.position.set(0, chamberY - CHAMBER_H * 0.5 + 0.10, chamberCenterZ);
  chamberFloor.receiveShadow = true;
  root.add(chamberFloor);

  // ── 5. Shelter zone — full enclosure (not large-tent partial). ─────
  // Located at the chamber center in WORLD coords (root.position + local).
  if (shelter) {
    addShelterZone(
      shelter,
      {
        x: pos.x + 0,
        y: pos.y + chamberY,
        z: pos.z + chamberCenterZ,
      },
      {
        x: CHAMBER_W * 0.5 - 0.2,
        y: CHAMBER_H * 0.5,
        z: CHAMBER_D * 0.5 - 0.2,
      },
      // Full enclosure — not the large-tent partial flag.
    );
  }

  // ── 6. Salvage panel inside the chamber, on the -Z (back) wall. ────
  // Panel at chamber back wall, mid-height, facing +Z (toward player
  // entering down the stairs). 'escape_pod' palette for medical loot.
  const panelLocalZ = chamberCenterZ - CHAMBER_D * 0.5 + 0.05;
  addAccessPanel(
    root,
    0, chamberY - 0.10, panelLocalZ,
    1,
    0,                       // faceYaw=0 → faces +Z (toward stair approach)
    'escape_pod',
  );

  // ── 7. Shadow flags + scene + collider. ────────────────────────────
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material !== _interiorMat) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(root);
  attachCompoundCollider(world, root);

  // ── 8. Register the panel as salvageable. ──────────────────────────
  if (salvageables) {
    const wp = new THREE.Vector3();
    root.updateWorldMatrix(true, false);
    root.traverse((o) => {
      const panel = o.userData.accessPanel;
      if (panel) {
        o.updateWorldMatrix(true, false);
        wp.setFromMatrixPosition(o.matrixWorld);
        registerSalvageable(salvageables, o, 'escape_pod', wp, rand);
      }
    });
  }

  return root;
}

/** Sample rocky-biome centroid positions for rocky entrances. Same
 *  greedy multi-region pattern as the dune cockpit + salt outpost. */
export function sampleRockyEntrancePositions(
  biomes: BiomeSampler,
  excludeCenters: ReadonlyArray<{ x: number; z: number; radius: number }>,
  count = 1,
): Array<{ x: number; z: number }> {
  const results: Array<{ x: number; z: number }> = [];
  const excludes: Array<{ x: number; z: number; radius: number }> = [...excludeCenters];
  excludes.push({
    x: Tuning.OPENING_SCENE_ANCHOR_X,
    z: Tuning.OPENING_SCENE_ANCHOR_Z,
    radius: Tuning.FLAGSHIP_SPAWN_EXCLUSION_RADIUS,
  });
  for (let i = 0; i < count; i++) {
    const c = findBiomeCentroid(biomes, 'rocky', { excludeCenters: excludes });
    if (!c) break;
    results.push(c);
    excludes.push({ x: c.x, z: c.z, radius: Tuning.POI_MIN_SEPARATION });
  }
  return results;
}
