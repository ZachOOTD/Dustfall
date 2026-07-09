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
import { makeRng, type Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeId } from './biomes.ts';
import type { SalvageableRegistry, Salvageable } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { addAccessPanelOriented } from './wrecks.ts';
import { mergeStaticByMaterial, makeSandMound } from './wreckForms.ts';
import { alignToTerrain } from '../util/terrainAlign.ts';
import { attachDeclaredColliders, type ColliderSpec } from '../physics/bodies.ts';
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
    // buryFrac (a fraction of the height) is scale-invariant — use it for a deeply-
    // swallowed wreck whose sand line should cross the hull AXIS regardless of size;
    // else the fixed `bury` metres. The proud-clamp keeps ≥(1-buryClampFrac) above sand.
    const raw = arch.params.buryFrac !== undefined
      ? arch.params.buryFrac * topY
      : arch.params.bury * (0.9 + phash(pos.x, pos.z) * 0.25);
    buryY = Math.min(raw, (arch.params.buryClampFrac ?? 0.5) * Math.max(0.4, topY));
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
  // Stamp the archetype id on the group so __game.identifyWreck() (dev) can name what
  // the player is looking at — the only reliable way to identify a specific procgen read.
  group.userData.poiArchetype = which;
  (opts.parent ?? scene).add(group);

  // Declared colliders → exact Rapier primitives at the placed world transform. Stash the
  // body on userData so a RUNTIME caller (the crash event) can remove it on reset/load —
  // world-gen POIs never need this, so it's a harmless additive tag for them.
  const poiBody = attachDeclaredColliders(world, group, result.colliders);
  group.userData.poiBody = poiBody;

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

  // Windward sand drift REMOVED (user 2026-06-18 — wrecks sit on bare terrain). The
  // makeSandMound CALL is retained but its mesh is DISCARDED (not added to the scene) so the
  // seeded procgen `rand` stream stays byte-identical → verify:placement/colliders unchanged
  // (D208/D221: dropping the rand draws would desync later panel placement). Reversible:
  // wrap the call back in `(opts.parent ?? scene).add(...)` to restore the drifts.
  if (arch.params.sandMound) {
    const sz = result.bbox.getSize(new THREE.Vector3());
    const radius = Math.min(11, Math.max(3.0, Math.max(sz.x, sz.z) * 0.5 + 1.8));
    makeSandMound(terrain, pos.x, pos.z, _windDir, radius, rand, { proud: 0.16 });   // rand-preserving no-op (mesh discarded)
  }

  return group;
}

// ════════════════════════════════════════════════════════════════════
// COLLIDER-AUDIT (ACBB Tier 3) — a headless gate that asserts every COLLIDABLE-SCALE mesh
// of a POI is covered by a declared collider. The ACBA adversarial critique caught three
// real author-error mismatches BY EYE (an un-collided tank dome, a mis-axis strut capsule,
// a float-seated debris chunk); this turns that into a `npm run verify:colliders` gate.
//
// Operates on the RAW pre-merge AssembleResult: the declared collider specs and the mesh
// placements both live in the assembly-root frame, so coverage is a pure local-space test
// (no Rapier, no world transform). A mesh whose every dimension is below a small threshold
// is an un-collidable trim (rivet / flap / LED) and is exempt; anything bigger the player
// could walk into MUST be ≥40%-covered by some declared collider (volume-sampled on a
// 3×3×3 grid) — catching both a wholly-orphaned body AND a collider on the wrong axis.
// ════════════════════════════════════════════════════════════════════
const _AUDIT_MIN_DIM = 0.7;   // a mesh smaller than this in EVERY axis is un-collidable trim → exempt
const _AUDIT_COVER = 0.4;     // a collidable mesh must have ≥40% of its sampled volume inside some collider
const _AUDIT_TOL = 0.12;      // collider-AABB expansion (m) so a slightly-inset collider still counts

export interface ColliderAuditResult { total: number; pass: number; fails: number; details: string[] }

/** AABB (assembly-root frame) of a declared collider spec, expanded by the tolerance. */
function colliderAABB(c: ColliderSpec): THREE.Box3 | null {
  if (c.kind === 'none') return null;
  if (c.kind === 'convex') {
    c.geo.computeBoundingBox();
    const box = (c.geo.boundingBox ?? new THREE.Box3()).clone();
    box.translate(new THREE.Vector3(c.pos.x, c.pos.y, c.pos.z));
    return box.expandByScalar(_AUDIT_TOL);
  }
  // extents in the collider's own frame (Rapier cylinder axis = local Y)
  const ex = c.kind === 'box' ? new THREE.Vector3(c.half.x, c.half.y, c.half.z)
    : c.kind === 'cylinder' ? new THREE.Vector3(c.radius, c.halfHeight, c.radius)
    : new THREE.Vector3(c.radius, c.radius, c.radius);   // ball
  const q = (c.kind !== 'ball' && c.quat)
    ? new THREE.Quaternion(c.quat.x, c.quat.y, c.quat.z, c.quat.w) : new THREE.Quaternion();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(c.pos.x, c.pos.y, c.pos.z), q, new THREE.Vector3(1, 1, 1));
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    box.expandByPoint(p.set(ex.x * sx, ex.y * sy, ex.z * sz).applyMatrix4(m));
  }
  return box.expandByScalar(_AUDIT_TOL);
}

/** Audit a raw assembled POI: are all collidable-scale meshes covered by declared colliders? */
export function auditPOIColliders(group: THREE.Group, colliders: ReadonlyArray<ColliderSpec>): ColliderAuditResult {
  const colBoxes = colliders.map(colliderAABB).filter((b): b is THREE.Box3 => b !== null);
  group.updateMatrixWorld(true);
  const details: string[] = [];
  let total = 0, pass = 0;
  const meshAABB = new THREE.Box3();
  const size = new THREE.Vector3();
  const pt = new THREE.Vector3();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    // The invariant is "every STRUCTURAL mass is collided". Skip DECORATIONS (surface detail
    // — flaps / formers / rivets / an overhead dish / cosmetic blobs that may protrude past
    // the colliders by design) and explicitly EXEMPT meshes (a hollow ENTERABLE shell whose
    // collision is its side-walls, not the shell volume — the husk). Tag checked up the chain.
    for (let n: THREE.Object3D | null = o; n && n !== group; n = n.parent) {
      if (n.userData?.isWreckDecoration || n.userData?.auditExempt) return;
    }
    m.geometry.computeBoundingBox();
    if (!m.geometry.boundingBox) return;
    meshAABB.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);   // group at identity pre-placement → root frame
    meshAABB.getSize(size);
    if (Math.max(size.x, size.y, size.z) < _AUDIT_MIN_DIM) return;       // small trim → exempt
    if (Math.min(size.x, size.y, size.z) < 0.06) return;                 // flat decal (no walk-into volume) → exempt
    total++;
    let inside = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      pt.set(meshAABB.min.x + size.x * i / 2, meshAABB.min.y + size.y * j / 2, meshAABB.min.z + size.z * k / 2);
      if (colBoxes.some((b) => b.containsPoint(pt))) inside++;
    }
    const cover = inside / 27;
    if (cover >= _AUDIT_COVER) pass++;
    else details.push(`${m.name || '(unnamed)'} ${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}m cover=${Math.round(cover * 100)}%`);
  });
  return { total, pass, fails: total - pass, details };
}

/** Assemble one archetype at a fixed seed (pre-merge) and audit its declared colliders. */
export function auditArchetypeColliders(archetype: ArchetypeId, seed: number): ColliderAuditResult & { archetype: string } {
  if (archetype === 'ship' || !ARCHETYPES[archetype]) return { archetype, total: 0, pass: 0, fails: 0, details: ['(no declared-collider audit for the legacy ship)'] };
  const rand = makeRng(seed);
  const result = ARCHETYPES[archetype].assemble(rand);
  return { archetype, ...auditPOIColliders(result.group, result.colliders) };
}
