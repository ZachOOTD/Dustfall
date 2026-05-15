// Hover speeder bike (Session CC). Dynamic Rapier rigid body with
// pitch+roll locked (only yaw rotates) so the chassis stays upright
// after collisions; PD hover controller keeps it floating ~1.2m above
// terrain via a Y-axis force each frame; W/S = throttle, A/D = steer
// torque, Shift = boost, Space = hop, E = mount/dismount.
//
// Mounted-rider model:
//   - ctx.speeder.mounted gates updatePlayer (player WASD ignored).
//   - updateSpeeder teleports the player's kinematic capsule to the
//     bike's rider seat each frame so the camera (sourced from the
//     player body) ends up at the rider's eyes.
//   - Mouse-look still works because PointerLockControls writes camera
//     rotation directly, not via the player body.
//
// Dismount: player capsule teleports 1.8m to the right of the bike's
// heading so they're standing alongside it, ready to re-mount.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';

export interface SpeederState {
  body: RAPIER.RigidBody;
  group: THREE.Group;
  mounted: boolean;
  /** Last-frame yaw of the bike (radians around Y). Cached so we can
   *  rotate rider-seat offsets without re-extracting from quaternion. */
  yaw: number;
  /** Current speed (m/s, horizontal). Useful for camera shake, audio. */
  speed: number;
}

// ── Materials — same palette as the wrecks so the bike feels in-universe.
const _hullMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_HEX,
  flatShading: true,
});
const _hullDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_DARK_HEX,
  flatShading: true,
});
const _rustMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_RUST_HEX,
  flatShading: true,
});
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: Tuning.WRECK_NOZZLE_INTERIOR_HEX,
});
const _nozzleRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
}

/**
 * Build the speeder bike geometry. Returns a THREE.Group with the bike
 * centered at its rider-seat position so that the body collider's
 * cuboid wraps cleanly.
 *
 * Local-space convention: bike points along -Z (forward = -Z), rider
 * seated at (0, ~0.55, +0.35). 2 thrust pods at +Z (rear).
 */
export function makeSpeeder(_rand: Rng): THREE.Group {
  const g = new THREE.Group();

  // ── Main fuselage — long narrow box.
  const fuselage = box(0.45, 0.32, 2.4, _hullMat);
  fuselage.position.set(0, 0, 0);
  g.add(fuselage);

  // ── Nose taper — narrower forward section sticking out the front.
  const nose = box(0.28, 0.24, 0.9, _hullDarkMat);
  nose.position.set(0, 0, -1.5);
  g.add(nose);
  // Nose-tip cone-ish detail.
  const tip = cyl(0.02, 0.16, 0.45, _hullDarkMat, 6);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0, -2.0);
  g.add(tip);

  // ── Cockpit — slightly raised block where the rider sits.
  const cockpit = box(0.55, 0.28, 0.7, _hullDarkMat);
  cockpit.position.set(0, 0.3, 0.35);
  g.add(cockpit);

  // ── Handlebars across the cockpit.
  const bars = cyl(0.045, 0.045, 0.7, _nozzleRimMat, 6);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 0.5, 0.0);
  g.add(bars);
  // Grip ends.
  for (const x of [-0.34, 0.34]) {
    const grip = cyl(0.055, 0.06, 0.14, _rustMat, 6);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(x, 0.5, 0.0);
    g.add(grip);
  }

  // ── 2 thrust pods at the rear.
  for (const side of [-1, 1] as const) {
    const pod = box(0.32, 0.32, 0.8, _hullMat);
    pod.position.set(side * 0.42, 0, 1.45);
    g.add(pod);
    // Engine bell ring (torus) facing +Z.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 6, 14),
      _hullDarkMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(side * 0.42, 0, 1.86);
    g.add(ring);
    // Dark inner disc — reads as the exhaust opening.
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 14),
      _nozzleInteriorMat,
    );
    inner.position.set(side * 0.42, 0, 1.87);
    g.add(inner);
  }

  // ── Side fins / skis hanging below.
  for (const side of [-1, 1] as const) {
    const fin = box(0.04, 0.18, 1.6, _hullDarkMat);
    fin.position.set(side * 0.28, -0.28, 0);
    g.add(fin);
    // Down-tilted leading edge (longer at front, taper toward back).
    const tipBox = box(0.04, 0.10, 0.35, _hullDarkMat);
    tipBox.position.set(side * 0.28, -0.36, -0.8);
    g.add(tipBox);
  }

  // ── Antenna whip on the back for silhouette character.
  const antenna = cyl(0.015, 0.025, 0.8, _nozzleRimMat, 5);
  antenna.position.set(-0.1, 0.7, 0.8);
  antenna.rotation.x = -0.15;
  g.add(antenna);

  // Shadow flags — bike casts + receives.
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return g;
}

/**
 * Spawn the speeder at the given world position. Creates a dynamic
 * rigid body with locked X+Z rotations (so the bike stays upright),
 * a single cuboid collider, and the meshes from makeSpeeder.
 */
export function placeSpeeder(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  rand: Rng,
): SpeederState {
  const group = makeSpeeder(rand);
  group.position.copy(pos);
  group.rotation.y = yaw;
  scene.add(group);

  // ── Dynamic body. Lock X+Z rotations (pitch + roll); allow Y (yaw)
  // freely so steering torque can rotate the bike. Pre-yaw the body so
  // it spawns facing the desired direction.
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    .setLinearDamping(Tuning.SPEEDER_LINEAR_DAMP)
    .setAngularDamping(Tuning.SPEEDER_ANGULAR_DAMP);
  const body = world.createRigidBody(bodyDesc);
  // setEnabledRotations(x, y, z, wakeUp) — only Y free, so the chassis
  // stays upright after collisions but still steers via yaw torque.
  body.setEnabledRotations(false, true, false, true);
  // Disable gravity for the bike — we drive Y entirely via velocity
  // control in updateSpeeder. Rapier's Euler-integrated gravity
  // re-applied per step otherwise cancels our hover velocity and the
  // bike settles below the target.
  body.setGravityScale(0, true);

  // ── Collider — single cuboid matching the fuselage (plus a little
  // margin for the cockpit + pods).
  const colDesc = RAPIER.ColliderDesc.cuboid(0.55, 0.45, 1.5)
    .setDensity(Tuning.SPEEDER_DENSITY)
    .setRestitution(0.1)
    .setFriction(0.4);
  world.createCollider(colDesc, body);

  return {
    body,
    group,
    mounted: false,
    yaw,
    speed: 0,
  };
}

// ── Per-frame update --------------------------------------------------------

const _bikeWorld = new THREE.Vector3();
const _bikeQuat = new THREE.Quaternion();
const _bikeEuler = new THREE.Euler();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _riderOffset = new THREE.Vector3();
const _ridePos = new THREE.Vector3();

export function updateSpeeder(ctx: GameContext, dt: number): void {
  const s = ctx.speeder;
  if (!s) return;
  const body = s.body;
  const pos = body.translation();
  const lv = body.linvel();

  // ── Read body yaw from quaternion (X+Z are locked, so it's effectively
  // just a rotation around Y).
  const rot = body.rotation();
  _bikeQuat.set(rot.x, rot.y, rot.z, rot.w);
  _bikeEuler.setFromQuaternion(_bikeQuat, 'YXZ');
  s.yaw = _bikeEuler.y;

  // ── Sync visual mesh to body.
  s.group.position.set(pos.x, pos.y, pos.z);
  s.group.quaternion.copy(_bikeQuat);

  // ── Hover — velocity-controlled toward (terrain + HOVER_HEIGHT).
  // PD-force was unstable in Rapier's Euler integrator at the stiffness
  // we need for "snappy hover". Direct velocity control is rock-solid
  // and reads identical to the player. Clamp target vy + lerp toward it
  // so the bike still has some inertia in the Y axis (small bumps over
  // dunes feel natural rather than glass-floor-rigid).
  const groundY = ctx.terrain.heightAt(pos.x, pos.z);
  const targetY = groundY + Tuning.SPEEDER_HOVER_HEIGHT;
  const yErr = targetY - pos.y;
  let targetVy = yErr * Tuning.SPEEDER_HOVER_K_P * 0.1;     // proportional response
  if (targetVy > 8) targetVy = 8;
  if (targetVy < -8) targetVy = -8;
  const lerp = 0.25;                                        // approach 25% per frame ≈ critical at 60fps
  const newVy = lv.y + (targetVy - lv.y) * lerp;
  body.setLinvel({ x: lv.x, y: newVy, z: lv.z }, true);

  // ── Cache horizontal speed for HUD / audio.
  s.speed = Math.hypot(lv.x, lv.z);

  // ── If not mounted, nothing else to do (bike just hovers in place).
  if (!s.mounted) {
    // Allow mount via E within range.
    const playerPos = ctx.player.body.body.translation();
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const distSq = dx * dx + dz * dz;
    if (
      ctx.input.pressed.has('KeyE') &&
      distSq <= Tuning.SPEEDER_MOUNT_RANGE * Tuning.SPEEDER_MOUNT_RANGE
    ) {
      s.mounted = true;
      ctx.ui.showToast?.('mounted speeder — E to dismount');
      // Park the player body far below the world so it can't collide
      // with the bike collider. We'll teleport it back on dismount.
      ctx.player.body.body.setNextKinematicTranslation({ x: 0, y: -2000, z: 0 });
    }
    return;
  }

  // ── Mounted — read input + apply forces.
  const { keys, pressed } = ctx.input;
  if (pressed.has('KeyE')) {
    s.mounted = false;
    // Teleport player to bike's right side. Use setTranslation (instant)
    // because updatePlayer runs LATER in the tick and would clobber a
    // setNextKinematicTranslation by reading the stale current position
    // (still parked at y=-2000) and rewriting it.
    _right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    const offX = pos.x + _right.x * Tuning.SPEEDER_DISMOUNT_OFFSET;
    const offZ = pos.z + _right.z * Tuning.SPEEDER_DISMOUNT_OFFSET;
    const offGround = ctx.terrain.heightAt(offX, offZ);
    const offY = offGround +
      ctx.player.body.halfHeight + ctx.player.body.radius + 0.05;
    ctx.player.body.body.setTranslation({ x: offX, y: offY, z: offZ }, true);
    ctx.ui.showToast?.('dismounted');
    return;
  }

  // ── Steering — bike yaw lerps toward camera yaw. The player steers
  // by looking with the mouse; bike visually follows. This is much
  // smoother than torque-based input and never spins out.
  const cam = ctx.three.camera;
  cam.getWorldDirection(_forward);
  _forward.y = 0;
  if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
  _forward.normalize();
  // Camera yaw: world direction (fx, fz) where bike's local -Z aligns
  // with this direction. -sin(yaw) = fx, -cos(yaw) = fz → yaw = atan2(-fx, -fz).
  const camYaw = Math.atan2(-_forward.x, -_forward.z);
  let yawErr = camYaw - s.yaw;
  // Wrap to [-π, π] so we always turn the short way around.
  if (yawErr > Math.PI) yawErr -= 2 * Math.PI;
  if (yawErr < -Math.PI) yawErr += 2 * Math.PI;
  let targetAngVel = yawErr * Tuning.SPEEDER_TURN_RESPONSE;
  if (targetAngVel > Tuning.SPEEDER_TURN_RATE_MAX) targetAngVel = Tuning.SPEEDER_TURN_RATE_MAX;
  if (targetAngVel < -Tuning.SPEEDER_TURN_RATE_MAX) targetAngVel = -Tuning.SPEEDER_TURN_RATE_MAX;
  const currentAngVel = body.angvel().y;
  const lerpedAngVel = currentAngVel + (targetAngVel - currentAngVel) * Tuning.SPEEDER_TURN_LERP;
  body.setAngvel({ x: 0, y: lerpedAngVel, z: 0 }, true);

  // ── Movement — velocity control toward a target XZ velocity computed
  // from W/S (forward/back along bike heading) and A/D (strafe lateral).
  // Lerp toward the target produces smooth accel + decel, no force
  // accumulation, no oscillation.
  const fwdInput = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const strafeInput = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const boosting = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  // Bike forward in world space (using bike's actual yaw, which is
  // lerping toward camera yaw — feels right because velocity tracks
  // the chassis, not the camera).
  const bfx = -Math.sin(s.yaw);
  const bfz = -Math.cos(s.yaw);
  // Bike right (perpendicular, 90° clockwise from forward in world XZ).
  const brx = -bfz;
  const brz = bfx;
  const fwdSpeedCap = (fwdInput > 0 && boosting) ? Tuning.SPEEDER_MAX_SPEED * Tuning.SPEEDER_BOOST_MULT : Tuning.SPEEDER_MAX_SPEED;
  const fwdSpeed = fwdInput > 0
    ? fwdInput * fwdSpeedCap
    : fwdInput * Tuning.SPEEDER_MAX_SPEED * Tuning.SPEEDER_REVERSE_MULT;
  const strSpeed = strafeInput * Tuning.SPEEDER_STRAFE_SPEED;
  const targetVx = bfx * fwdSpeed + brx * strSpeed;
  const targetVz = bfz * fwdSpeed + brz * strSpeed;
  const lerpedVx = lv.x + (targetVx - lv.x) * Tuning.SPEEDER_ACCEL_LERP;
  const lerpedVz = lv.z + (targetVz - lv.z) * Tuning.SPEEDER_ACCEL_LERP;
  body.setLinvel({ x: lerpedVx, y: newVy, z: lerpedVz }, true);

  // Hop — Space gives a small upward impulse.
  if (pressed.has('Space')) {
    body.applyImpulse({ x: 0, y: Tuning.SPEEDER_HOP_IMPULSE, z: 0 }, true);
  }

  // ── Drive the camera directly from the rider seat. Rider seat is a
  // bike-local offset; rotate by yaw to get world offset. We don't
  // teleport the player body (would collide with the speeder's
  // collider and push it around) — the camera independently follows
  // the bike. PointerLockControls keeps writing camera rotation, so
  // mouse-look still works.
  _riderOffset.set(
    Tuning.SPEEDER_RIDER_SEAT_X,
    Tuning.SPEEDER_RIDER_SEAT_Y,
    Tuning.SPEEDER_RIDER_SEAT_Z,
  );
  const cos = Math.cos(s.yaw);
  const sin = Math.sin(s.yaw);
  const rx = _riderOffset.x * cos + _riderOffset.z * sin;
  const rz = -_riderOffset.x * sin + _riderOffset.z * cos;
  _ridePos.set(pos.x + rx, pos.y + _riderOffset.y, pos.z + rz);
  ctx.three.camera.position.set(_ridePos.x, _ridePos.y, _ridePos.z);
  // Player body stays where it was at mount time; reset gravity so it
  // doesn't accumulate while parked.
  ctx.player.velocityY = 0;
  ctx.player.onGround = true;

  // Avoid unused warning if dt isn't used elsewhere (forces are dt-agnostic).
  void dt;
  void _bikeWorld;
}
