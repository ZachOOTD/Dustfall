// Rapier-driven first-person controller.
// Camera position is sourced from the kinematic capsule body each frame.
// Rotation is still handled by PointerLockControls (mouse-look only — we
// no longer call moveForward/moveRight, which would write to position).

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playFootstep } from '../audio/audio.ts';

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const desired = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = -25; // m/s^2

const STEP_DISTANCE = 1.7;       // meters between footsteps (walking)
const STEP_DISTANCE_SPRINT = 1.4; // shorter cadence when sprinting
let _stepAccum = 0;

export function updatePlayer(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) {
    // Sync camera to body even when not playing so death cam doesn't drift.
    syncCameraToBody(ctx);
    return;
  }

  const { body, collider, controller } = ctx.player.body;
  const { keys } = ctx.input;
  const f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const r = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const moving = f !== 0 || r !== 0;
  const sprinting =
    (keys['ShiftLeft'] || keys['ShiftRight']) && ctx.stats.thirst > 0.02 && moving;
  const speed = Tuning.WALK_SPEED * (sprinting ? Tuning.SPRINT_MULTIPLIER : 1);

  // Horizontal direction in camera-yaw space (no pitch).
  ctx.three.camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  right.crossVectors(fwd, UP).normalize();

  desired.set(0, 0, 0);
  desired.addScaledVector(fwd, f);
  desired.addScaledVector(right, r);
  if (desired.lengthSq() > 0) desired.normalize();
  desired.multiplyScalar(speed * dt);

  // Gravity
  ctx.player.velocityY += GRAVITY * dt;
  desired.y = ctx.player.velocityY * dt;

  // Ask Rapier for the corrected delta (handles collisions, slopes, autostep).
  controller.computeColliderMovement(collider, desired);
  const corrected = controller.computedMovement();

  const tr = body.translation();
  body.setNextKinematicTranslation({
    x: tr.x + corrected.x,
    y: tr.y + corrected.y,
    z: tr.z + corrected.z,
  });

  ctx.player.onGround = controller.computedGrounded();
  if (ctx.player.onGround && ctx.player.velocityY < 0) ctx.player.velocityY = 0;

  // Footsteps — accumulate horizontal distance moved while grounded; trigger
  // a sound each time we cross the step threshold.
  if (ctx.player.onGround && moving) {
    const horizontal = Math.hypot(corrected.x, corrected.z);
    _stepAccum += horizontal;
    const threshold = sprinting ? STEP_DISTANCE_SPRINT : STEP_DISTANCE;
    if (_stepAccum >= threshold) {
      _stepAccum = 0;
      playFootstep();
    }
  } else {
    _stepAccum = 0;
  }

  // Day/night clock advances only while playing.
  ctx.time.dayTime = (ctx.time.dayTime + dt / Tuning.DAY_LENGTH_SECONDS) % 1;

  syncCameraToBody(ctx);
}

function syncCameraToBody(ctx: GameContext): void {
  const tr = ctx.player.body.body.translation();
  ctx.three.camera.position.set(
    tr.x,
    tr.y + ctx.player.eyeOffset,
    tr.z,
  );
}
