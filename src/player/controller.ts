// Rapier-driven first-person controller.
// Camera position is sourced from the kinematic capsule body each frame.
// Rotation is still handled by PointerLockControls (mouse-look only — we
// no longer call moveForward/moveRight, which would write to position).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
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

// ABP Tier 3 — 3P camera polish:
//   - offsets bumped per research (3.2m back / 1.8m above, was 2.5/1.5)
//   - Rapier raycast collision; clamps camera forward on hit with a
//     0.3m pushback buffer
//   - smoothed follow at ~10/s lerp toward intended position
//   - 3P-specific pitch clamp [-π/4, π/3] via post-rotation guard
//     (PointerLockControls own clamp is [-π/2, π/2])
//   - snap on teleport via ctx.player.cameraSnapNextFrame flag (set by
//     mount/dismount/save-load systems; auto-clears each frame)
// ABT P1 — Over-the-shoulder camera. Pre-ABT was 3.2m back + 1.8m
// above (research-recommended) but read as "way above player" per user
// feedback. New values match modern over-shoulder convention (TLOU2 /
// GoW / Souls): close behind + barely above shoulder + lateral offset
// over right shoulder. Anchor target on shoulder height, not above-head.
const _3P_BACK_DIST = 1.8;             // was 3.2 — close-behind
const _3P_ABOVE_DIST = 0.30;           // was 1.8 — barely above shoulder
const _3P_LATERAL_OFFSET = 0.40;       // NEW — over right shoulder
const _3P_SHOULDER_DROP = 0.25;        // NEW — shoulder is ~25cm below eye
const _3P_PUSHBACK_BUFFER = 0.3;
const _3P_LERP_RATE = 10.0;            // per-second smoothing
const _3P_PITCH_MIN = -Math.PI / 4;    // -45° (camera can look up at sky)
const _3P_PITCH_MAX = Math.PI / 3;     // +60° (camera can look down at player)

const _camTarget = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _shoulderAnchor = new THREE.Vector3();
const _rayOrig = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: 0, z: 0 };

function syncCameraToBody(ctx: GameContext): void {
  const tr = ctx.player.body.body.translation();
  if (ctx.flags.thirdPerson) {
    const cam = ctx.three.camera;

    // 3P pitch clamp — PointerLockControls allows looking straight up /
    // down, but in 3P that breaks the camera (camera flips overhead or
    // stares into terrain). Clamp pitch on the live camera rotation.
    const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    if (euler.x < _3P_PITCH_MIN) {
      euler.x = _3P_PITCH_MIN;
      cam.quaternion.setFromEuler(euler);
    } else if (euler.x > _3P_PITCH_MAX) {
      euler.x = _3P_PITCH_MAX;
      cam.quaternion.setFromEuler(euler);
    }

    cam.getWorldDirection(_camFwd);
    // Camera-right in the horizontal plane (perpendicular to camFwd,
    // ignoring pitch). Used to offset camera laterally (over right
    // shoulder).
    _camRight.set(_camFwd.z, 0, -_camFwd.x).normalize();

    // Shoulder anchor: player position + eye height - shoulder drop +
    // lateral offset over right shoulder. This is the AIM TARGET that
    // the camera looks at, not the camera position.
    _shoulderAnchor.set(
      tr.x + _camRight.x * _3P_LATERAL_OFFSET,
      tr.y + ctx.player.eyeOffset - _3P_SHOULDER_DROP,
      tr.z + _camRight.z * _3P_LATERAL_OFFSET,
    );

    // Camera position: pull back from shoulder anchor along -camFwd,
    // plus a small upward bias to look slightly down at the action.
    _camTarget.set(
      _shoulderAnchor.x - _camFwd.x * _3P_BACK_DIST,
      _shoulderAnchor.y + _3P_ABOVE_DIST - _camFwd.y * _3P_BACK_DIST,
      _shoulderAnchor.z - _camFwd.z * _3P_BACK_DIST,
    );

    // Spring-arm raycast collision via Rapier. Cast from shoulder anchor
    // backward along -camFwd. If something blocks the cast within
    // _3P_BACK_DIST, clamp the camera to (hit.toi - pushback) along the
    // ray (closer to player), preventing wall clipping.
    _rayOrig.x = _shoulderAnchor.x;
    _rayOrig.y = _shoulderAnchor.y;
    _rayOrig.z = _shoulderAnchor.z;
    _rayDir.x = -_camFwd.x;
    _rayDir.y = -_camFwd.y + _3P_ABOVE_DIST / _3P_BACK_DIST;
    _rayDir.z = -_camFwd.z;
    const _dirLen = Math.hypot(_rayDir.x, _rayDir.y, _rayDir.z);
    if (_dirLen > 1e-6) {
      _rayDir.x /= _dirLen; _rayDir.y /= _dirLen; _rayDir.z /= _dirLen;
    }
    const ray = new RAPIER.Ray(_rayOrig, _rayDir);
    const hit = ctx.physics.world.castRay(
      ray, _3P_BACK_DIST, true,
      0 as unknown as RAPIER.QueryFilterFlags,
      undefined,
      undefined,
      ctx.player.body.body,           // exclude player body
    );
    if (hit) {
      const safeDist = Math.max(0.2, hit.timeOfImpact - _3P_PUSHBACK_BUFFER);
      _camTarget.set(
        _shoulderAnchor.x + _rayDir.x * safeDist,
        _shoulderAnchor.y + _rayDir.y * safeDist,
        _shoulderAnchor.z + _rayDir.z * safeDist,
      );
    }

    // Smoothed follow — lerp camera position toward target at ~10/s.
    // Snap immediately on teleport events.
    if (ctx.player.cameraSnapNextFrame) {
      cam.position.copy(_camTarget);
      ctx.player.cameraSnapNextFrame = false;
    } else {
      // Frame-rate-independent damp: 1 - exp(-rate * dt). Approx dt=1/60.
      const alpha = 1 - Math.exp(-_3P_LERP_RATE * (1 / 60));
      cam.position.lerp(_camTarget, alpha);
    }
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
