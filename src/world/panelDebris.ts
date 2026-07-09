// ACAX — salvage-panel door POP-OFF physics.
//
// When a panel is pried, completePry rolls SALVAGE_PANEL_POP_CHANCE: on a hit the
// door breaks LOOSE instead of swinging open on the hinge — it detaches from the
// panel, becomes a dynamic Rapier body (cuboid collider, the same friction /
// restitution / CCD feel as a dropped item), pops OUTWARD off the hull with a
// slight upward arc + a tumble, then falls + settles on the ground.
//
// It's a dedicated tiny debris system — NOT the pickups list — so a fallen door is
// just scenery, never E-takeable. The bodies sleep when they settle (Rapier
// auto-sleep); we skip syncing sleeping doors so settled debris is ~free.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playMetalClang } from '../audio/audio.ts';

interface DoorDebris { mesh: THREE.Object3D; body: RAPIER.RigidBody; }
const _debris: DoorDebris[] = [];

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _outward = new THREE.Vector3();

/** Detach the panel's door visual + launch it as a physics body. Returns true if a
 *  door was actually popped (false if the panel has no poppable door ref). */
export function popPanelDoor(ctx: GameContext, panel: THREE.Object3D): boolean {
  const visual = panel.userData.panelDoorVisual as THREE.Object3D | undefined;
  const ext = panel.userData.panelDoorExtents as { hx: number; hy: number; hz: number } | undefined;
  if (!visual || !ext) return false;

  // World pose of the (still-closed) door at the instant it breaks loose.
  visual.updateWorldMatrix(true, false);
  visual.matrixWorld.decompose(_pos, _quat, _scl);
  const px = _pos.x, py = _pos.y, pz = _pos.z;
  const qx = _quat.x, qy = _quat.y, qz = _quat.z, qw = _quat.w;

  // Reparent to the scene root, PRESERVING the world transform, so the mesh keeps
  // sitting exactly where it was while the body takes over driving it.
  ctx.three.scene.attach(visual);

  // Dynamic body at the door's world pose. Mirrors the dropped-item tuning so it
  // falls + settles the same way; a bit less damping so the door tumbles freely.
  const bd = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(px, py, pz)
    .setRotation({ x: qx, y: qy, z: qz, w: qw })
    .setLinearDamping(0.3)
    .setAngularDamping(0.4)
    .setCcdEnabled(true);
  const body = ctx.physics.world.createRigidBody(bd);
  const shape = RAPIER.ColliderDesc.cuboid(ext.hx, ext.hy, ext.hz)
    .setFriction(0.9).setRestitution(0.18).setDensity(1.6);
  ctx.physics.world.createCollider(shape, body);

  // POP: launch OUTWARD (the door's local +Z faces away from the hull) + a slight
  // upward arc, plus a random tumble. setLinvel/Angvel (not impulse) → mass-
  // independent, so the pop reads the same regardless of panel size.
  _outward.set(0, 0, 1).applyQuaternion(_quat).normalize();
  const pop = Tuning.SALVAGE_PANEL_POP_SPEED;
  body.setLinvel({
    x: _outward.x * pop + (Math.random() - 0.5) * 0.5,
    y: _outward.y * pop + Tuning.SALVAGE_PANEL_POP_UP,
    z: _outward.z * pop + (Math.random() - 0.5) * 0.5,
  }, true);
  const spin = Tuning.SALVAGE_PANEL_POP_SPIN;
  body.setAngvel({
    x: (Math.random() - 0.5) * spin,
    y: (Math.random() - 0.5) * spin,
    z: (Math.random() - 0.5) * spin,
  }, true);

  _debris.push({ mesh: visual, body });
  playMetalClang();
  return true;
}

const _sp = new THREE.Vector3();
const _sq = new THREE.Quaternion();
/** Per-frame: copy each AWAKE popped door's body transform → its mesh. Runs after
 *  physics.step. Sleeping (settled) doors are skipped — their mesh already holds
 *  the final resting pose, so settled debris costs nothing. */
export function updatePanelDebris(_ctx: GameContext, _dt: number): void {
  for (const d of _debris) {
    if (d.body.isSleeping()) continue;
    const t = d.body.translation();
    const r = d.body.rotation();
    _sp.set(t.x, t.y, t.z);
    _sq.set(r.x, r.y, r.z, r.w);
    d.mesh.position.copy(_sp);
    d.mesh.quaternion.copy(_sq);
  }
}

/** Debug (rig-shot smoke test): per-door {y, sleeping, count}. */
export function panelDebrisInfo(): { count: number; doors: Array<{ y: number; sleeping: boolean }> } {
  return { count: _debris.length, doors: _debris.map((d) => ({ y: d.mesh.position.y, sleeping: d.body.isSleeping() })) };
}
