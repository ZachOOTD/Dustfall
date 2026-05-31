// ACF — B1 Phase 3 follow-up: drag a slain kill behind an anchor.
//
// A downed raider corpse (anchored to the player, dragged on foot or behind
// a player-tethered sled) or a slain sandworm carcass (anchored to the
// speeder only — the carcass is far too massive to drag on foot) becomes a
// TOWED body riding the shared inextensible-rope constraint
// (ropeConstraint.ts). This is the first non-sled caller of that helper.
//
// Architecture:
//   - The kill is always the TOWED body; the anchor end is stored on the
//     kill as `dragAnchor: RopeEndpoint` ({ kind: 'none' } = not dragged).
//   - This system runs each frame AFTER updateRaiders / updateSandWorm
//     (both of which `continue` past dead entities, leaving their movement
//     to us) and BEFORE updateSledRiders.
//   - The constraint moves the kinematic body; we then sync the entity's
//     VISUAL transform to the post-snap XZ (per-kind: raider group sits on
//     the terrain; worm carcass stays half-buried at its dead-pose depth).
//   - A sagged rope tube is drawn between the anchor and the kill each
//     frame (self-contained here, keyed by entity id — no per-entity field).
//   - Interaction routing (interaction.ts) sets/clears `dragAnchor`; this
//     system auto-clears it (with a toast) when the rope tears or the
//     anchor entity is gone.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { resolveEndpointWorldPos } from './rope.ts';
import { applyInextensibleConstraint } from './ropeConstraint.ts';

// Reused each iteration — the constraint mutates this in place, but a
// dragged dead-weight body carries no managed velocity of its own, so we
// zero it every frame (the perpendicular-damp branch still settles swing).
const _scratchVel = { vx: 0, vz: 0 };

const NONE = { kind: 'none' as const };

// ── Rope visual (self-contained; mirrors the sled rope look) ──────────
const _ropeMat = new THREE.MeshLambertMaterial({ color: Tuning.SLED_ROPE_COLOR_HEX });
const _raiderRopes = new Map<number, THREE.Mesh>();
const _wormRopes = new Map<number, THREE.Mesh>();
const _curvePts = [
  new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  new THREE.Vector3(), new THREE.Vector3(),
];
const _liveRaiderRopes = new Set<number>();
const _liveWormRopes = new Set<number>();

function makeRopeMesh(ctx: GameContext): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0.01),
  ]);
  const geo = new THREE.TubeGeometry(curve, 1, Tuning.SLED_ROPE_RADIUS, 6, false);
  const mesh = new THREE.Mesh(geo, _ropeMat);
  mesh.castShadow = true;
  mesh.frustumCulled = false; // endpoints can sit just outside the frustum
  ctx.three.scene.add(mesh);
  return mesh;
}

/** Rebuild a rope tube between `anchor` and `end` with parabolic sag that
 *  relaxes to straight as the rope goes taut at `maxDist`. */
function rebuildRope(
  mesh: THREE.Mesh,
  anchor: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  maxDist: number,
): void {
  const horiz = Math.hypot(end.x - anchor.x, end.z - anchor.z);
  const sagFrac = Math.min(1, Math.max(0, maxDist - horiz) / maxDist);
  const sag = Tuning.SLED_ROPE_SAG * sagFrac;
  _curvePts[0].set(anchor.x, anchor.y, anchor.z);
  _curvePts[4].set(end.x, end.y, end.z);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    _curvePts[i].set(
      anchor.x + (end.x - anchor.x) * t,
      anchor.y + (end.y - anchor.y) * t - Math.sin(Math.PI * t) * sag,
      anchor.z + (end.z - anchor.z) * t,
    );
  }
  const curve = new THREE.CatmullRomCurve3(_curvePts, false, 'catmullrom', 0.5);
  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(curve, 16, Tuning.SLED_ROPE_RADIUS, 6, false);
}

function disposeRope(ctx: GameContext, map: Map<number, THREE.Mesh>, id: number): void {
  const mesh = map.get(id);
  if (!mesh) return;
  ctx.three.scene.remove(mesh);
  mesh.geometry.dispose();   // shared material — don't dispose
  map.delete(id);
}

export function updateKillDrag(ctx: GameContext): void {
  _liveRaiderRopes.clear();
  _liveWormRopes.clear();

  // ── Raider corpses ────────────────────────────────────────────────
  for (const r of ctx.raiders) {
    const anchor = r.dragAnchor;
    if (!anchor || anchor.kind === 'none') continue;
    // Only a dead raider is a draggable corpse — if it somehow isn't dead,
    // drop the tether defensively.
    if (r.bb.state !== 'dead') { r.dragAnchor = NONE; continue; }

    const anchorPos = resolveEndpointWorldPos(ctx, anchor);
    if (!anchorPos) { r.dragAnchor = NONE; continue; }  // anchor despawned

    const tr = r.body.translation();
    _scratchVel.vx = 0; _scratchVel.vz = 0;
    const res = applyInextensibleConstraint(
      {
        attachX: tr.x, attachY: tr.y, attachZ: tr.z,
        bodyX: tr.x, bodyY: tr.y, bodyZ: tr.z,
        body: r.body, slideVel: _scratchVel,
        hy: Tuning.KILL_DRAG_RAIDER_HY,
        groundClearance: Tuning.KILL_DRAG_GROUND_CLEARANCE,
      },
      anchorPos,
      {
        maxDist: Tuning.KILL_DRAG_RAIDER_MAX_DIST,
        tearDist: Tuning.KILL_DRAG_RAIDER_TEAR_DIST,
        snapPerpDamp: Tuning.KILL_DRAG_SNAP_PERP_DAMP,
        terrain: ctx.terrain,
      },
    );

    if (res.torn) {
      r.dragAnchor = NONE;
      ctx.ui.showToast('the rope slips off the corpse');
      continue;
    }
    if (res.snapped) {
      // Dead raider visual sits flat on the sand — group Y is the terrain
      // height (the dead pose lays the body on the ground), not the body's
      // capsule-center Y. (Orienting the corpse to trail head-first is a
      // visual-triage refinement — deferred until verified against the
      // flop/die-clip dead pose so we don't fight it.)
      const groundY = ctx.terrain.heightAt(res.postX, res.postZ);
      r.group.position.set(res.postX, groundY, res.postZ);
    }

    // Rope visual: anchor → corpse belt (a touch above the flopped body).
    const groundY = ctx.terrain.heightAt(res.postX, res.postZ);
    let rope = _raiderRopes.get(r.id);
    if (!rope) { rope = makeRopeMesh(ctx); _raiderRopes.set(r.id, rope); }
    rebuildRope(rope, anchorPos, { x: res.postX, y: groundY + 0.35, z: res.postZ },
      Tuning.KILL_DRAG_RAIDER_MAX_DIST);
    _liveRaiderRopes.add(r.id);
  }

  // ── Sandworm carcasses ────────────────────────────────────────────
  for (const w of ctx.sandWorms.list) {
    const anchor = w.dragAnchor;
    if (!anchor || anchor.kind === 'none') continue;
    if (w.state !== 'dead') { w.dragAnchor = NONE; continue; }
    // The worm is towable ONLY behind the speeder (design fork resolved
    // ACF — a 24m carcass dragged by a hand-rope is absurd). Guard here so
    // a stale non-speeder anchor can't drive it.
    if (anchor.kind !== 'speeder') { w.dragAnchor = NONE; continue; }

    const anchorPos = resolveEndpointWorldPos(ctx, anchor);
    if (!anchorPos) { w.dragAnchor = NONE; continue; }  // speeder gone

    const bp = w.basePos;
    _scratchVel.vx = 0; _scratchVel.vz = 0;
    const res = applyInextensibleConstraint(
      {
        attachX: bp.x, attachY: bp.y, attachZ: bp.z,
        bodyX: bp.x, bodyY: bp.y, bodyZ: bp.z,
        body: w.body, slideVel: _scratchVel,
        hy: Tuning.KILL_DRAG_WORM_HY,
        groundClearance: Tuning.KILL_DRAG_GROUND_CLEARANCE,
      },
      anchorPos,
      {
        maxDist: Tuning.KILL_DRAG_WORM_MAX_DIST,
        tearDist: Tuning.KILL_DRAG_WORM_TEAR_DIST,
        snapPerpDamp: Tuning.KILL_DRAG_SNAP_PERP_DAMP,
        terrain: ctx.terrain,
      },
    );

    if (res.torn) {
      w.dragAnchor = NONE;
      ctx.ui.showToast('the carcass tears free of the rope');
      continue;
    }
    if (res.snapped) {
      // Keep the carcass at its half-buried dead-pose depth at the new XZ
      // (mirrors transitionToDead's basePos.y math). mesh tracks basePos.
      // (Yawing the long body to trail head-first is a visual-triage
      // refinement — deferred until verified against applySandWormDeadPose's
      // rotation so we don't fight it.)
      const surfaceY = ctx.terrain.heightAt(res.postX, res.postZ);
      w.basePos.set(res.postX, surfaceY - Tuning.SANDWORM_MAX_RADIUS * 0.5, res.postZ);
      w.mesh.position.copy(w.basePos);
    }

    // Rope visual: speeder tow-bar → carcass (on top of the hide).
    const surfaceY = ctx.terrain.heightAt(res.postX, res.postZ);
    let rope = _wormRopes.get(w.id);
    if (!rope) { rope = makeRopeMesh(ctx); _wormRopes.set(w.id, rope); }
    rebuildRope(rope, anchorPos, { x: res.postX, y: surfaceY + 1.2, z: res.postZ },
      Tuning.KILL_DRAG_WORM_MAX_DIST);
    _liveWormRopes.add(w.id);
  }

  // ── Dispose ropes for kills that stopped being dragged this frame ──
  // (snapshot keys — disposeRope mutates the map).
  for (const id of [..._raiderRopes.keys()]) {
    if (!_liveRaiderRopes.has(id)) disposeRope(ctx, _raiderRopes, id);
  }
  for (const id of [..._wormRopes.keys()]) {
    if (!_liveWormRopes.has(id)) disposeRope(ctx, _wormRopes, id);
  }
}
