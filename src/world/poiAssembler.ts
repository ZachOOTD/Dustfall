// POI placement pipeline (ACBA — POI variety overhaul).
//
// placeProcgenPOI is the new single entry point for "drop a procedural point-of-interest
// here". It rolls an ARCHETYPE (biome-weighted); `ship` delegates to the legacy linear
// assembler (placeProcgenComposite) so today's hulls still appear, while the new
// archetypes (satellite, tank cluster, …) run a generalized copy of that pipeline's
// post-assembly half — burial / terrain-align / DECLARED colliders / bucket re-skin /
// static merge / salvage-panel placement + prune / sand mound — so collision, salvage
// and the draw-call merge all behave identically to ships, just on non-tube silhouettes.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeId } from './biomes.ts';
import type { SalvageableRegistry, Salvageable } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { addAccessPanelOriented } from './wrecks.ts';
import { mergeStaticByMaterial, makeSandMound } from './wreckForms.ts';
import { alignToTerrain } from '../util/terrainAlign.ts';
import { attachDeclaredColliders } from '../physics/bodies.ts';
import { placeProcgenComposite, reskinToBucket, getBucketMats, pruneBuriedPanels } from './procgenWreck.ts';
import { phash } from './poiComponents.ts';
import { ARCHETYPES, pickArchetype, type ArchetypeId } from './poiArchetypes.ts';

export interface PlacePOIOpts {
  /** Force one archetype (rig inspection / tuning). Else biome-weighted roulette. */
  archetype?: ArchetypeId;
  biome?: BiomeId;
  parent?: THREE.Object3D;
  /** Pass-through bury for the `ship` delegate. */
  buryY?: number;
}

const _windDir = new THREE.Vector2(0.85, 0.52).normalize();

export function placeProcgenPOI(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
  opts: PlacePOIOpts = {},
): THREE.Group {
  const which: ArchetypeId = opts.archetype ?? pickArchetype(rand, opts.biome);
  if (which === 'ship') {
    return placeProcgenComposite(scene, world, terrain, pos, rand, salvageables, {
      biome: opts.biome, parent: opts.parent, buryY: opts.buryY,
    });
  }
  const arch = ARCHETYPES[which];
  const result = arch.assemble(rand, opts.biome);
  const group = result.group;

  // ── Position + bury + yaw + terrain-align + crash-list ──
  group.position.copy(pos);
  const topY = result.bbox.max.y;   // height above the group's ground plane (y=0)
  let buryY: number;
  if (arch.params.burySink) {
    const raw = arch.params.bury * (0.9 + phash(pos.x, pos.z) * 0.25);
    buryY = Math.min(raw, 0.5 * Math.max(0.4, topY));   // keep ≥50% proud
  } else {
    // A standing structure beds its base into the surface so the WIDE flat foundation
    // doesn't float a downhill corner over a dune. Sized to the footprint half-width ×
    // a gentle slope so the base edges stay in the sand; clamped so it never swallows.
    const halfSpan = Math.max(result.bbox.max.x - result.bbox.min.x, result.bbox.max.z - result.bbox.min.z) * 0.5;
    buryY = arch.params.seatSink ?? Math.min(0.5, 0.18 + halfSpan * 0.06);
  }
  group.position.y -= buryY;
  const yaw = rand() * Math.PI * 2;
  // Standing structures conform to the slope (so the flat base seats flush) but only
  // PARTIALLY — a tank farm leaning to a full dune normal reads wrong; sampleRadius is
  // wide so it averages over micro-relief into a gentle, believable settle.
  alignToTerrain(group, terrain, pos.x, pos.z, yaw, arch.params.burySink ? 1.5 : 2.4);
  if (arch.params.list) {
    const mag = arch.params.list * (0.55 + 0.45 * phash(pos.x, pos.z));
    group.rotateX(phash(pos.z, pos.x) < 0.5 ? mag : -mag);
  }
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  (opts.parent ?? scene).add(group);

  // Declared colliders → exact Rapier primitives at the placed world transform.
  attachDeclaredColliders(world, group, result.colliders);

  // Re-skin shared hull mats to the archetype's bucket (BEFORE merge groups by material).
  reskinToBucket(group, getBucketMats(arch.params.bucket));

  // ── Salvage panels at DECLARED mounts. Add (live) before merge; register (consumes
  //    rand) + prune AFTER merge so the occlusion test sees the merged hull. ──
  if (salvageables && result.panelMounts.length) {
    const span = arch.params.panelMax - arch.params.panelMin + 1;
    const want = Math.min(result.panelMounts.length, arch.params.panelMin + Math.floor(rand() * span));
    const placed: { mesh: THREE.Mesh; kind: Salvageable['kind'] }[] = [];
    for (let i = 0; i < want; i++) {
      const pm = result.panelMounts[i];
      const mesh = addAccessPanelOriented(group, pm.pos, pm.quat, 1, pm.kind);
      placed.push({ mesh, kind: pm.kind });
    }
    mergeStaticByMaterial(group);   // live panels are skipped by the merge
    const registered: Salvageable[] = [];
    for (const { mesh, kind } of placed) {
      mesh.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
      registered.push(registerSalvageable(salvageables, mesh, kind, wp, rand));
    }
    pruneBuriedPanels(group, registered, salvageables, terrain);
  } else {
    mergeStaticByMaterial(group);
  }

  // Windward sand drift (only when the archetype wants it — towers stand clean-footed).
  if (arch.params.sandMound) {
    const sz = result.bbox.getSize(new THREE.Vector3());
    const radius = Math.min(8, Math.max(2.5, Math.max(sz.x, sz.z) * 0.5));
    (opts.parent ?? scene).add(makeSandMound(terrain, pos.x, pos.z, _windDir, radius, rand));
  }

  return group;
}
