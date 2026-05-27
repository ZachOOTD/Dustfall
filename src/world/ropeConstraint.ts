// Generalized inextensible-rope constraint (B1 Phase 3, Session ACE).
//
// Extracted from sled.ts's updateSleds constraint block. Same math, now
// callable from any system that needs to keep two bodies within a fixed
// distance via position-correction + radial-velocity damping.
//
// Two callers ship in ACE:
//   1. Sled tow — sled.ts retains its own velocity-managing scalars
//      (_slideVx/_slideVz) and calls this helper to apply the constraint
//      once the anchor + distance are known.
//   2. Corpse / carcass drag — new endpoint kinds (raider_corpse,
//      sandworm_carcass) wire a tethered body through the same helper
//      so the same end-of-line behavior + perpendicular damping applies.
//
// History:
//   QQ-2 — first cut as inline math in updateSleds (D67).
//   ACD — slope-slide rewrite via managed scalars + body type switch to
//         KinematicPositionBased (D122/D123). The constraint logic itself
//         survived unchanged through ACD.
//   ACE — extracted here so non-sled tethers can reuse it.
//
// Architecture:
//   The caller is responsible for:
//     - resolving the anchor world position (use rope.resolveEndpointWorldPos)
//     - computing the towed body's ATTACH POINT (often offset from body
//       center; sled's attach is the front yoke, corpse's is body center)
//     - tracking + supplying managed velocity scalars
//     - running this helper INSIDE the per-frame physics tick
//     - reacting to the returned `torn` flag (detach + toast)
//   This module is data-only: it computes the corrected position + new
//   velocity scalars, writes to body via setNextKinematicTranslation, and
//   reports whether the rope tore. It does not own the rope mesh or any
//   per-body state.
//
// Future Phase 4 (post-ACE): pull the YAW lerp + sand-puff cadence + drag
// tracks into this module too once they have multiple callers. For now
// those stay in updateSleds as sled-specific behavior.

import type RAPIER from '@dimforge/rapier3d-compat';
import type { Terrain } from './terrain.ts';

/** State of the body being constrained. The caller fills this in each
 *  frame. Callers with their own velocity-integration scheme (sled) pass
 *  their managed scalars in via `slideVel`; the helper mutates the object
 *  in place when a snap occurs. */
export interface InextensibleConstraintTarget {
  /** Current world-space attach point on the towed body (where rope meets
   *  it). For a sled this is the front yoke; for a corpse this is body
   *  center. Used for distance computation against the anchor. */
  attachX: number;
  attachY: number;
  attachZ: number;
  /** Current body translation (what setNextKinematicTranslation last wrote
   *  this frame, after slope-slide). The constraint applies the same XZ
   *  shift to this as it does to the attach point — they're rigidly
   *  related. */
  bodyX: number;
  bodyY: number;
  bodyZ: number;
  /** The body the constraint translates. Must be KinematicPositionBased. */
  body: RAPIER.RigidBody;
  /** Managed velocity scalars (XZ). Mutated in place when a snap fires.
   *  The "radial-away" component is zeroed; the perpendicular component
   *  is damped by `params.snapPerpDamp`. Callers that don't track XZ
   *  velocity (static corpse just dragged via setTranslation each frame)
   *  can pass an object both fields can be safely overwritten. */
  slideVel: { vx: number; vz: number };
  /** Body Y half-extent for terrain-clamping the post-snap Y. */
  hy: number;
  /** Additional Y clearance above terrain (so the body doesn't sink into
   *  sand on a slope after a snap). */
  groundClearance: number;
}

export interface InextensibleConstraintParams {
  /** Beyond this distance, the rope is taut — apply position correction. */
  maxDist: number;
  /** Beyond this distance, the rope tears (rope yanked too hard). Set
   *  to Infinity for unbreakable ropes. */
  tearDist: number;
  /** 0..1 damping applied to perpendicular velocity component at snap.
   *  Lower = sled "swings" more violently around the anchor; higher =
   *  motion calms quickly to a tangential glide. */
  snapPerpDamp: number;
  /** Terrain for Y-clamping post-snap position (so the body doesn't end
   *  up below the heightfield after a snap shifts it XZ). */
  terrain: Terrain;
}

export interface InextensibleConstraintResult {
  /** True if the constraint detected an overstretched rope and applied a
   *  position + velocity correction. False = rope was slack, no-op. */
  snapped: boolean;
  /** True if the rope tore (distance exceeded `tearDist`). Caller should
   *  detach + toast. When torn, position correction is NOT applied (no
   *  point — the rope is gone). */
  torn: boolean;
  /** Post-constraint body XYZ position. When snapped: the corrected
   *  position. When unsnapped: matches the input bodyX/Y/Z verbatim.
   *  Callers may want this for downstream computations (rope mesh
   *  rebuild, frame-delta accounting, etc.). */
  postX: number;
  postY: number;
  postZ: number;
}

/** Apply the inextensible-rope constraint to a single towed body.
 *
 *  Behavior:
 *   - dist <= maxDist: rope is slack, no-op. Returns { snapped: false }.
 *   - dist > tearDist: rope tears. Returns { torn: true }. NO position
 *     change applied (caller should detach + toast).
 *   - maxDist < dist <= tearDist: rope is taut.
 *       (1) Translate the body INWARD along the anchor-to-attach axis by
 *           the stretch amount, clamping post-snap Y above terrain.
 *       (2) Zero the RADIAL-AWAY component of slideVel (rope physically
 *           cannot move further away — and storing "outward energy" would
 *           re-fire the snap every frame).
 *       (3) Damp the PERPENDICULAR component of slideVel by snapPerpDamp
 *           (rope holds the body at end-of-line; perpendicular motion
 *           from sideways slopes would otherwise fling the body around
 *           the anchor circle).
 *     Returns { snapped: true, postX/Y/Z: corrected position }.
 *
 *  Caller flow:
 *    const result = applyInextensibleConstraint(target, anchor, params);
 *    if (result.torn) { detachRope(sled, 'rope snapped'); continue; }
 *    if (result.snapped) {
 *      // Downstream code reads result.postX/Y/Z (body translation has
 *      // already been written via setNextKinematicTranslation).
 *    }
 */
export function applyInextensibleConstraint(
  target: InextensibleConstraintTarget,
  anchor: { x: number; y: number; z: number },
  params: InextensibleConstraintParams,
): InextensibleConstraintResult {
  // Distance from anchor to body attach point — horizontal only, as in
  // sled.ts's pre-extraction math. Rope sag handles the Y difference
  // visually; mechanical taut-ness is XZ.
  const dx = target.attachX - anchor.x;
  const dz = target.attachZ - anchor.z;
  const dist = Math.hypot(dx, dz);

  if (dist > params.tearDist) {
    return {
      snapped: false,
      torn: true,
      postX: target.bodyX,
      postY: target.bodyY,
      postZ: target.bodyZ,
    };
  }

  if (dist <= params.maxDist || dist <= 1e-4) {
    return {
      snapped: false,
      torn: false,
      postX: target.bodyX,
      postY: target.bodyY,
      postZ: target.bodyZ,
    };
  }

  // Rope is taut — apply position correction.
  const stretch = dist - params.maxDist;
  // Unit vector FROM attach TOWARD anchor (pull direction).
  const ux = -dx / dist;
  const uz = -dz / dist;

  // 1) Position correction — translate body inward by full stretch in
  //    XZ. Y is sampled at the new XZ and clamped above terrain.
  const newBodyX = target.bodyX + ux * stretch;
  const newBodyZ = target.bodyZ + uz * stretch;
  const groundY = params.terrain.heightAt(newBodyX, newBodyZ);
  const newBodyY = groundY + target.hy + target.groundClearance;
  target.body.setNextKinematicTranslation({ x: newBodyX, y: newBodyY, z: newBodyZ });

  // 2) Velocity correction — operates on managed scalars only. Zero the
  //    radial-away component (rope inextensibility); damp perpendicular.
  const vx = target.slideVel.vx;
  const vz = target.slideVel.vz;
  const vRadial = vx * ux + vz * uz;
  if (vRadial < 0) {
    // Moving AWAY from anchor along the radial axis (negative because
    // ux/uz points toward anchor). Subtract the radial-away component
    // out entirely, then damp what's left (the perpendicular).
    const afterRadialX = vx - vRadial * ux;
    const afterRadialZ = vz - vRadial * uz;
    target.slideVel.vx = afterRadialX * params.snapPerpDamp;
    target.slideVel.vz = afterRadialZ * params.snapPerpDamp;
  }
  // If vRadial >= 0 (body already moving toward anchor), preserve
  // velocity unchanged — no fight against the rope to correct.

  return {
    snapped: true,
    torn: false,
    postX: newBodyX,
    postY: newBodyY,
    postZ: newBodyZ,
  };
}
