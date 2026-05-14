// Factory helpers for static + kinematic Rapier bodies + colliders.

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

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

const _aabb = new THREE.Box3();
const _aabbCenter = new THREE.Vector3();
const _aabbSize = new THREE.Vector3();
/**
 * Attach a static axis-aligned-box collider that snugly matches the world-space
 * bounding volume of `obj`. Cheap one-collider approximation; less accurate
 * than attachCompoundCollider for tilted composites but useful when shape
 * fidelity doesn't matter (e.g., a simple buried prop).
 */
export function attachAabbCollider(
  world: RAPIER.World,
  obj: THREE.Object3D,
  shrink = 0,
): RAPIER.Collider {
  obj.updateMatrixWorld(true);
  _aabb.setFromObject(obj);
  _aabb.getCenter(_aabbCenter);
  _aabb.getSize(_aabbSize);
  const hx = Math.max(0.05, _aabbSize.x * 0.5 - shrink);
  const hy = Math.max(0.05, _aabbSize.y * 0.5 - shrink);
  const hz = Math.max(0.05, _aabbSize.z * 0.5 - shrink);
  const bd = RAPIER.RigidBodyDesc.fixed().setTranslation(
    _aabbCenter.x, _aabbCenter.y, _aabbCenter.z,
  );
  const body = world.createRigidBody(bd);
  return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
}

const _wpos = new THREE.Vector3();
const _wquat = new THREE.Quaternion();
const _wscale = new THREE.Vector3();
const _meshAabb = new THREE.Box3();
const _meshAabbCenter = new THREE.Vector3();
const _meshAabbSize = new THREE.Vector3();

/**
 * Attach one collider per child Mesh of `obj`, shaped to match the underlying
 * primitive geometry (cuboid → BoxGeometry, cylinder → CylinderGeometry,
 * ball → IcosahedronGeometry / SphereGeometry, cone → ConeGeometry). All
 * colliders attach to a single fixed RigidBody at origin; each collider's
 * local transform encodes the mesh's world-space pose.
 *
 * Unsupported geometries (TorusGeometry, custom BufferGeometry) fall back to
 * a per-mesh world-space AABB cuboid so collision is never silently dropped.
 * CircleGeometry meshes are intentionally skipped (2D, no real volume).
 *
 * Set `mesh.userData.noCollider = true` on any child that should be omitted.
 */
export function attachCompoundCollider(
  world: RAPIER.World,
  obj: THREE.Object3D,
): RAPIER.RigidBody {
  obj.updateMatrixWorld(true);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.noCollider) return;
    const geo = mesh.geometry as THREE.BufferGeometry & {
      type: string;
      parameters?: Record<string, number>;
    };
    if (!geo) return;

    mesh.getWorldPosition(_wpos);
    mesh.getWorldQuaternion(_wquat);
    mesh.getWorldScale(_wscale);
    const quat = { x: _wquat.x, y: _wquat.y, z: _wquat.z, w: _wquat.w };

    let desc: RAPIER.ColliderDesc | null = null;

    switch (geo.type) {
      case 'BoxGeometry': {
        const p = geo.parameters!;
        desc = RAPIER.ColliderDesc.cuboid(
          (p.width  / 2) * _wscale.x,
          (p.height / 2) * _wscale.y,
          (p.depth  / 2) * _wscale.z,
        );
        break;
      }
      case 'CylinderGeometry': {
        const p = geo.parameters!;
        const halfHeight = (p.height / 2) * _wscale.y;
        const radius = Math.max(p.radiusTop, p.radiusBottom) *
                       Math.max(_wscale.x, _wscale.z);
        desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
        break;
      }
      case 'ConeGeometry': {
        const p = geo.parameters!;
        const halfHeight = (p.height / 2) * _wscale.y;
        const radius = p.radius * Math.max(_wscale.x, _wscale.z);
        desc = RAPIER.ColliderDesc.cone(halfHeight, radius);
        break;
      }
      case 'IcosahedronGeometry':
      case 'SphereGeometry':
      case 'DodecahedronGeometry':
      case 'OctahedronGeometry':
      case 'TetrahedronGeometry': {
        const p = geo.parameters!;
        const radius = p.radius * Math.max(_wscale.x, _wscale.y, _wscale.z);
        desc = RAPIER.ColliderDesc.ball(radius);
        break;
      }
      case 'CircleGeometry':
        // 2D disc — visual only, no collision.
        return;
      default: {
        // Torus + any custom BufferGeometry: per-mesh world-space AABB so the
        // collider still blocks the player even if we can't pick a precise shape.
        _meshAabb.setFromObject(mesh);
        _meshAabb.getCenter(_meshAabbCenter);
        _meshAabb.getSize(_meshAabbSize);
        const aabbDesc = RAPIER.ColliderDesc.cuboid(
          Math.max(0.02, _meshAabbSize.x * 0.5),
          Math.max(0.02, _meshAabbSize.y * 0.5),
          Math.max(0.02, _meshAabbSize.z * 0.5),
        ).setTranslation(_meshAabbCenter.x, _meshAabbCenter.y, _meshAabbCenter.z);
        world.createCollider(aabbDesc, body);
        return;
      }
    }

    desc = desc
      .setTranslation(_wpos.x, _wpos.y, _wpos.z)
      .setRotation(quat);
    world.createCollider(desc, body);
  });

  return body;
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
