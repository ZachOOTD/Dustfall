// Rapier-driven first-person controller.
// Camera position is sourced from the kinematic capsule body each frame.
// Rotation is still handled by PointerLockControls (mouse-look only — we
// no longer call moveForward/moveRight, which would write to position).

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  playFootstepSand,
  playFootstepRock,
  playFootstepSalt,
  playFootstepWet,
} from '../audio/audio.ts';

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const desired = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = -25; // m/s^2

const STEP_DISTANCE = 1.7;       // meters between footsteps (walking)
const STEP_DISTANCE_SPRINT = 1.4; // shorter cadence when sprinting
let _stepAccum = 0;
let _stepParity = 0;             // alternates 0/1 → ±lateral offset for L/R foot

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
  // Crouch: hold LeftControl. Disables sprint, lowers camera, slows speed.
  ctx.player.crouching = !!(keys['ControlLeft'] || keys['ControlRight']);
  ctx.player.eyeOffset = ctx.player.crouching
    ? Tuning.CROUCH_EYE_OFFSET
    : Tuning.PLAYER_EYE_OFFSET;
  const sprinting =
    !ctx.player.crouching &&
    (keys['ShiftLeft'] || keys['ShiftRight']) &&
    ctx.stats.thirst > 0.02 &&
    ctx.stats.stamina > Tuning.STAMINA_SPRINT_THRESHOLD &&
    moving;
  let speed = Tuning.WALK_SPEED;
  if (sprinting) speed *= Tuning.SPRINT_MULTIPLIER;
  else if (ctx.player.crouching) speed *= Tuning.CROUCH_SPEED_MULTIPLIER;

  // Stamina: drains while sprinting; recovers otherwise.
  if (sprinting) {
    ctx.stats.stamina = Math.max(0, ctx.stats.stamina - Tuning.STAMINA_DRAIN_SPRINT * dt);
  } else {
    ctx.stats.stamina = Math.min(1, ctx.stats.stamina + Tuning.STAMINA_RECOVER_PER_SEC * dt);
  }

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

  // Jump: Space while grounded kicks velocityY upward; gravity does the rest.
  if (ctx.player.onGround && ctx.input.pressed.has('Space')) {
    ctx.player.velocityY = Tuning.JUMP_VELOCITY;
  }

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
  // a sound each time we cross the step threshold. Variant is picked from
  // biomeAt + proximity to any water source (wet beats biome). Same beat
  // also stamps a footprint decal — alternating L/R foot via _stepParity,
  // skipped on rocky biome (Session Y).
  const horizontal = Math.hypot(corrected.x, corrected.z);
  if (ctx.player.onGround && moving) {
    _stepAccum += horizontal;
    const threshold = sprinting ? STEP_DISTANCE_SPRINT : STEP_DISTANCE;
    if (_stepAccum >= threshold) {
      _stepAccum = 0;
      const tr = body.translation();
      const wet = nearWaterSource(ctx, tr.x, tr.z);
      const biome = ctx.biomes.biomeAt(tr.x, tr.z);
      if (wet) {
        playFootstepWet();
      } else if (biome === 'rocky') {
        playFootstepRock();
      } else if (biome === 'salt') {
        playFootstepSalt();
      } else {
        playFootstepSand();
      }
      // Decal — skip on rocky (no impression in rock). Wet/salt/dune all stamp.
      if (biome !== 'rocky') {
        const yaw = Math.atan2(fwd.x, fwd.z);
        const sign = _stepParity === 0 ? -1 : 1;
        const offX = right.x * Tuning.FOOTPRINT_LATERAL_OFFSET * sign;
        const offZ = right.z * Tuning.FOOTPRINT_LATERAL_OFFSET * sign;
        const toeOut = Tuning.FOOTPRINT_PLAYER_TOEOUT_RAD * sign;
        ctx.footprints.spawn('player', tr.x + offX, tr.z + offZ, yaw + toeOut, ctx.time.elapsed);
        _stepParity ^= 1;
      }
    }
  } else {
    _stepAccum = 0;
  }

  // Day/night clock advances only while playing.
  const prevDayTime = ctx.time.dayTime;
  ctx.time.dayTime = (ctx.time.dayTime + dt / Tuning.DAY_LENGTH_SECONDS) % 1;
  // Detect wrap (1.0 → 0): prevDayTime was near 1, new value is near 0.
  if (prevDayTime > 0.9 && ctx.time.dayTime < 0.1) {
    ctx.time.daysSurvived++;
  }

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

function nearWaterSource(ctx: GameContext, x: number, z: number): boolean {
  const r = Tuning.FOOTSTEP_WET_RADIUS;
  const r2 = r * r;
  for (const w of ctx.waterSources.list) {
    const dx = w.pos.x - x;
    const dz = w.pos.z - z;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}
