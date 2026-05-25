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
import { spawnFootprintPuff } from '../world/footprintPuffs.ts';

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const desired = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = -25; // m/s^2

// JJ-2 — step distances bumped to land at natural cadence with the
// faster movement speeds (WALK_SPEED 6.0 / sprint 13.2 m/s).
// Walk: 3.0m / 6.0 m/s ≈ 2 steps/sec (typical human pace).
// Sprint: 4.5m / 13.2 m/s ≈ 2.9 steps/sec (typical run pace).
// Old values produced ~3.5 / ~9.4 steps/sec, which read as a rapid-fire
// rattle.
const STEP_DISTANCE = 3.0;       // meters between footsteps (walking)
const STEP_DISTANCE_SPRINT = 4.5; // longer cadence per sprint stride
let _stepAccum = 0;
let _stepParity = 0;             // alternates 0/1 → ±lateral offset for L/R foot

/** QQ — true iff the player is the active endpoint of a sled rope.
 *  Cheap O(sleds), n is a handful. */
function isTowingOnFoot(ctx: GameContext): boolean {
  for (const s of ctx.sleds.list) {
    if (s.tether.kind === 'player') return true;
  }
  return false;
}

export function updatePlayer(ctx: GameContext, dt: number): void {
  // Mounted on speeder (Session CC): updateSpeeder already wrote the
  // camera position from the rider seat. Skip syncCameraToBody (player
  // body is parked off-world, so its translation isn't meaningful).
  // Mouse-look via PointerLockControls keeps writing camera rotation.
  // This check runs BEFORE the isPlaying gate because we want the
  // camera-from-speeder to persist even when controls aren't locked
  // (e.g., during pause or in preview without pointer lock).
  if (ctx.speeder?.mounted) {
    const prev = ctx.time.dayTime;
    ctx.time.dayTime = (ctx.time.dayTime + dt / Tuning.DAY_LENGTH_SECONDS) % 1;
    if (prev > 0.9 && ctx.time.dayTime < 0.1) ctx.time.daysSurvived++;
    return;
  }
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

  // Stamina: drains while sprinting; recovers otherwise. JJ-2 — gated
  // by DEBUG_UNLIMITED_STAMINA for testing (pins stamina at 1.0 so the
  // sprint gate at line ~62 always passes). QQ — towing a sled on foot
  // multiplies sprint drain by STAMINA_TOW_FACTOR.
  if (Tuning.DEBUG_UNLIMITED_STAMINA) {
    ctx.stats.stamina = 1;
  } else if (sprinting) {
    let drain = Tuning.STAMINA_DRAIN_SPRINT;
    if (isTowingOnFoot(ctx)) drain *= Tuning.STAMINA_TOW_FACTOR;
    ctx.stats.stamina = Math.max(0, ctx.stats.stamina - drain * dt);
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
        // AAG — small upward dust puff at the foot position (same skip-on-rocky
        // logic as the decal). Wet ground (near water sources) also dampens
        // dust kicks — skip there.
        if (!wet) {
          const groundY = ctx.terrain.heightAt(tr.x + offX, tr.z + offZ);
          spawnFootprintPuff(tr.x + offX, groundY, tr.z + offZ);
        }
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

// ABO A3 — 3P camera state. Pointer-lock owns yaw + pitch via the
// camera's rotation directly (PointerLockControls in FP). For 3P we
// reuse the same rotation (camera quaternion → camDir) but offset the
// camera position behind+above the player. Spring-arm collision is
// SKIPPED in this pass — the camera can clip dunes/walls; left as
// debt for a future polish session.
const _3P_BACK_DIST = 2.5;
const _3P_ABOVE_DIST = 1.5;
const _3P_LOOK_AT_HEAD_OFFSET = 1.0;   // look at player head, not feet

function syncCameraToBody(ctx: GameContext): void {
  const tr = ctx.player.body.body.translation();
  if (ctx.flags.thirdPerson) {
    // ABO A3 — 3rd-person spring-arm. Camera yaw + pitch are still owned
    // by pointer-lock (PointerLockControls hasn't been moved here), but
    // we DON'T set camera.position to the player; instead offset behind
    // by the camera's forward direction. Position = player_head_pos -
    // forward * back_dist + up * above_dist. The camera continues to
    // look forward (pointer-lock direction), and the player rig appears
    // in front of the camera.
    const cam = ctx.three.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const headX = tr.x;
    const headY = tr.y + ctx.player.eyeOffset;
    const headZ = tr.z;
    cam.position.set(
      headX - fwd.x * _3P_BACK_DIST,
      headY + _3P_ABOVE_DIST - fwd.y * _3P_BACK_DIST,
      headZ - fwd.z * _3P_BACK_DIST,
    );
    // Keep look direction (PointerLockControls already set camera.quaternion).
    void _3P_LOOK_AT_HEAD_OFFSET;
    return;
  }
  // FP — camera at eyes (existing behavior).
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
