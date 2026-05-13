// Factory helpers for static + kinematic Rapier bodies + colliders.

import RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';

type Vec3Like = { x: number; y: number; z: number };
type QuatLike = { x: number; y: number; z: number; w: number };

export function makeStaticBox(
  world: RAPIER.World,
  halfExtents: Vec3Like,
  pos: Vec3Like,
  quat?: QuatLike,
): RAPIER.Collider {
  let bd = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
  if (quat) bd = bd.setRotation(quat);
  const body = world.createRigidBody(bd);
  return world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
    body,
  );
}

export function makeStaticCylinder(
  world: RAPIER.World,
  halfHeight: number,
  radius: number,
  pos: Vec3Like,
  quat?: QuatLike,
): RAPIER.Collider {
  let bd = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
  if (quat) bd = bd.setRotation(quat);
  const body = world.createRigidBody(bd);
  return world.createCollider(
    RAPIER.ColliderDesc.cylinder(halfHeight, radius),
    body,
  );
}

/**
 * Convex hull from a mesh's geometry. Applies the optional scale to vertices
 * before building the hull (Rapier hulls are in the body's local frame).
 */
export function makeStaticConvexHull(
  world: RAPIER.World,
  geo: THREE.BufferGeometry,
  pos: Vec3Like,
  quat?: QuatLike,
  scale?: THREE.Vector3,
): RAPIER.Collider | null {
  const posAttr = geo.attributes.position;
  if (!posAttr) return null;
  const verts = new Float32Array(posAttr.count * 3);
  const sx = scale?.x ?? 1;
  const sy = scale?.y ?? 1;
  const sz = scale?.z ?? 1;
  for (let i = 0; i < posAttr.count; i++) {
    verts[i * 3]     = posAttr.getX(i) * sx;
    verts[i * 3 + 1] = posAttr.getY(i) * sy;
    verts[i * 3 + 2] = posAttr.getZ(i) * sz;
  }
  const desc = RAPIER.ColliderDesc.convexHull(verts);
  if (!desc) return null;
  let bd = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
  if (quat) bd = bd.setRotation(quat);
  const body = world.createRigidBody(bd);
  return world.createCollider(desc, body);
}

/**
 * Cheap collider from a GLTF model's world-space bounding box.
 * For v1 we approximate every prop as a box; this is good enough for
 * Kenney's low-poly survival pack. Switch to convex hull per-mesh later
 * if anything feels too box-like.
 */
export function attachBoundsCollider(
  world: RAPIER.World,
  group: THREE.Object3D,
  pos: Vec3Like,
  quat?: QuatLike,
): RAPIER.Collider {
  // Bounds in the group's *local* (untransformed) frame — the collider
  // sits at the body's translation/rotation already.
  const bbox = computeBounds(group);
  const halfExtents = {
    x: Math.max(0.05, (bbox.max.x - bbox.min.x) / 2),
    y: Math.max(0.05, (bbox.max.y - bbox.min.y) / 2),
    z: Math.max(0.05, (bbox.max.z - bbox.min.z) / 2),
  };
  return makeStaticBox(world, halfExtents, pos, quat);
}

function computeBounds(obj: THREE.Object3D): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry?.attributes?.position) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      if (x < min.x) min.x = x;
      if (y < min.y) min.y = y;
      if (z < min.z) min.z = z;
      if (x > max.x) max.x = x;
      if (y > max.y) max.y = y;
      if (z > max.z) max.z = z;
    }
  });
  if (!isFinite(min.x)) return { min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } };
  return { min, max };
}

export interface PlayerBody {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  halfHeight: number;
  radius: number;
}

/**
 * Kinematic capsule player + Rapier KinematicCharacterController with step-up,
 * slope limit, and ground snap.
 *
 * Total capsule height = 2*radius + 2*halfHeight.
 */
export function makePlayer(
  world: RAPIER.World,
  halfHeight: number,
  radius: number,
  pos: Vec3Like,
): PlayerBody {
  const bd = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pos.x, pos.y, pos.z);
  const body = world.createRigidBody(bd);
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(halfHeight, radius),
    body,
  );
  const controller = world.createCharacterController(0.05);
  controller.enableAutostep(0.3, 0.15, true); // climb 0.3m steps, min width 0.15m
  controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  controller.enableSnapToGround(0.3);
  controller.setApplyImpulsesToDynamicBodies(true);
  return { body, collider, controller, halfHeight, radius };
}
