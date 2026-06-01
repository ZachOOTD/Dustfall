// Session ACJ — procedural SkinnedMesh limb builder.
//
// The pre-ACJ rig (playerRig.ts) was rigid Lathe/Box primitives parented at
// joint Groups (shoulder→elbow→wrist). Rigid parts can't deform across a
// joint, so every joint was a hard SEAM — the elbow/knee/wrist "popped" and
// the hand read as a disconnected block jutting off the forearm. That's a
// foundation ceiling no amount of geometry polish breaks through.
//
// This module replaces a limb with ONE continuous tube skinned to a small
// bone chain, so the joint bends SMOOTHLY (vertices near the joint blend
// between the two bones). Still 100% procedural (D107 zero-asset) — geometry
// + skin weights are generated in code, no GLB asset.
//
// Technique: lathe a radius profile into a tube (top at y=0, extending -Y),
// then assign each vertex a skinIndex/skinWeight from its Y position relative
// to the mid joint. A linear blend band of ±blendBand around the mid joint
// gives the smooth bend. The end bone (wrist/ankle) carries the hand/foot as
// a rigid child; the tube itself is weighted only to root + mid.
//
// Bind math (Three r184, AttachedBindMode = default): we updateMatrixWorld the
// bone chain in limb-local space (root at identity) BEFORE constructing the
// Skeleton so boneInverses capture the rest pose; bind() then uses the mesh's
// (identity) world as bindMatrix. Once the mesh is added under a moving parent
// (spineBend/body), attached-mode recomputes bindMatrixInverse from the live
// matrixWorld each frame, so the limb follows the body correctly and bone
// rotations deform relative to rest. See the long-form derivation in the ACJ
// changelog entry.

import * as THREE from 'three';

export interface SkinnedLimbResult {
  /** The skinned tube. Position it at the limb's attach point in the parent
   *  and add it to the scene graph. */
  mesh: THREE.SkinnedMesh;
  /** Root bone (shoulder/hip) — drives the whole-limb swing. Already a child
   *  of `mesh`. */
  rootBone: THREE.Bone;
  /** Middle joint bone (elbow/knee) — drives the lower-segment bend. */
  midBone: THREE.Bone;
  /** End bone (wrist/ankle) — carries the hand/foot as a rigid child. */
  endBone: THREE.Bone;
}

/**
 * Build a 2-segment skinned limb (root → mid → end) from a lathe profile.
 *
 * @param profile   Lathe points (x = radius, y = limb-local height, descending
 *                  from 0 at the top to -totalLen at the bottom). The tube is
 *                  this profile revolved around the Y axis.
 * @param radialSegments  Lathe radial divisions.
 * @param midY      Y of the middle joint (elbow/knee), negative.
 * @param endY      Y of the end joint (wrist/ankle), negative, below midY.
 * @param blendBand Half-width of the linear weight blend around midY. Larger =
 *                  softer, more rounded joint; smaller = tighter, more crease.
 * @param material  Material for the tube (skinning chunks auto-injected for a
 *                  SkinnedMesh in r184).
 */
export function buildSkinnedLimb(opts: {
  profile: THREE.Vector2[];
  radialSegments: number;
  midY: number;
  endY: number;
  blendBand: number;
  material: THREE.Material;
}): SkinnedLimbResult {
  const { profile, radialSegments, midY, endY, blendBand, material } = opts;

  // 1. Tube geometry.
  const geo = new THREE.LatheGeometry(profile, radialSegments);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;

  // 2. Per-vertex skin weights. Bone 0 = root (upper segment), bone 1 = mid
  //    (lower segment). Blend linearly across ±blendBand around midY.
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  const bandTop = midY + blendBand;     // above this → 100% root
  const bandBot = midY - blendBand;     // below this → 100% mid
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    let wRoot: number;
    if (y >= bandTop) wRoot = 1;
    else if (y <= bandBot) wRoot = 0;
    else wRoot = (y - bandBot) / (2 * blendBand);   // 1 at top of band → 0 at bottom
    const o = i * 4;
    skinIndices[o] = 0;          // root bone
    skinIndices[o + 1] = 1;      // mid bone
    skinWeights[o] = wRoot;
    skinWeights[o + 1] = 1 - wRoot;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));

  // 3. Bone chain in limb-local space (root at origin, descending -Y).
  const rootBone = new THREE.Bone();
  rootBone.position.set(0, 0, 0);
  const midBone = new THREE.Bone();
  midBone.position.set(0, midY, 0);          // local to root
  rootBone.add(midBone);
  const endBone = new THREE.Bone();
  endBone.position.set(0, endY - midY, 0);   // local to mid
  midBone.add(endBone);

  // 4. Capture rest-pose world matrices, then bind. Must updateMatrixWorld
  //    BEFORE constructing the Skeleton (calculateInverses reads matrixWorld
  //    as-is). At this point the root has no parent → world == limb-local.
  rootBone.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([rootBone, midBone, endBone]);

  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.add(rootBone);
  mesh.bind(skeleton);
  // Rest-pose bounds don't cover the posed limb (a bent elbow swings the
  // forearm well outside the straight-tube box) → disable culling so the arm
  // never vanishes at oblique camera angles.
  mesh.frustumCulled = false;

  return { mesh, rootBone, midBone, endBone };
}
