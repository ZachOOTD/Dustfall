// Session AAE — creature companion (inspired by Rocky from Project Hail
// Mary). A small radially-symmetric red exoskeleton creature that
// follows the player. Two locomotion states + an idle state:
//
//   rolling — far from player (≥ FAR distance). Legs retract, body
//             rotates around its travel axis, body translates fast.
//             "Sprint" of the creature.
//   walking — close range (CLOSE..FAR). Legs extend + animate in a
//             sin-wave gait, body translates slower, upright orientation.
//   idle    — very close (< CLOSE distance) AND player isn't fleeing.
//             Body bobs gently (breathing). Legs twitch slightly.
//
// Pocketable: RMB on the deployed companion via wieldAction.ts
// `handleContextAction` packs it back into the player's inventory as a
// `companion_pod`. LMB on the wielded pod redeploys.
//
// Singleton per save — ctx.companion is `Companion | null`.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { addItem } from '../inventory/inventory.ts';

// AAO — `huddle` added. At storm peak (`weather.intensity > HUDDLE_THRESHOLD`)
// the companion overrides any far/close logic and presses to the ground
// with legs tucked. Reads as "Rocky is weathering the storm with you."
export type CompanionState = 'rolling' | 'walking' | 'idle' | 'huddle';

export interface Companion {
  /** Root group. Position tracks the creature's world location each frame. */
  group: THREE.Group;
  /** Sub-group of body + legs that's rotated/translated per state. */
  body: THREE.Group;
  /** Each leg's pivot group for the gait animation. */
  legs: THREE.Group[];
  /** World-space position. Authoritative for movement; group.position
   *  is synced from this each frame. */
  pos: THREE.Vector3;
  /** Heading angle (radians, 0 = +Z facing). Used for walking-state
   *  body yaw + rolling-state roll axis. */
  heading: number;
  state: CompanionState;
  /** Time-in-current-state — used by idle bob and state-entry effects. */
  stateTimer: number;
  /** Visual roll angle accumulated during rolling state. Drives body
   *  rotation around the perpendicular-to-travel axis. */
  rollAngle: number;
  /** Hover flag for raycast interaction (RMB pack-up). */
  hovered: boolean;
}

const _PI2 = Math.PI * 2;

/** Build the creature's visual. Returns the root group + per-leg pivots
 *  so the AI can animate them per state. */
function makeCompanionVisual(): {
  group: THREE.Group;
  body: THREE.Group;
  legs: THREE.Group[];
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const R = Tuning.COMPANION_BODY_RADIUS;
  const LL = Tuning.COMPANION_LEG_LENGTH;

  // Body — IcosahedronGeometry with flat-shading reads as a rocky
  // crystalline carapace. Two materials alternated across facets for
  // shadow variation (no per-face split, just a darker secondary mesh
  // at slight offset for highlight contrast).
  const bodyMat = new THREE.MeshLambertMaterial({
    color: Tuning.COMPANION_COLOR_HEX,
    flatShading: true,
  });
  const darkMat = new THREE.MeshLambertMaterial({
    color: Tuning.COMPANION_DARK_COLOR_HEX,
    flatShading: true,
  });
  // Main carapace
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 0), bodyMat);
  main.position.y = R;             // sit on ground (lowest vertex at y=0)
  body.add(main);
  // Slightly smaller darker inner shell for shadow detail
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.85, 0), darkMat);
  inner.position.y = R - 0.01;
  inner.scale.set(1, 0.9, 1);      // slight oblate for shape variation
  body.add(inner);

  // Single eye — small dark dot near the body's "front" (+Z local).
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x140808 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
  eye.position.set(0, R + 0.05, R * 0.92);
  body.add(eye);
  // Slight white glint above the eye
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xf0e8d0 });
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), glintMat);
  glint.position.set(0.01, R + 0.07, R * 0.95);
  body.add(glint);

  // 5 radial legs. Each is its own pivot group so we can animate them
  // (lift+lower in a walking gait, retract in rolling state).
  const legs: THREE.Group[] = [];
  const legMat = new THREE.MeshLambertMaterial({
    color: Tuning.COMPANION_DARK_COLOR_HEX,
    flatShading: true,
  });
  const tipMat = new THREE.MeshLambertMaterial({
    color: 0x3a1408,
    flatShading: true,
  });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * _PI2;
    const legPivot = new THREE.Group();
    legPivot.position.set(
      Math.cos(angle) * R * 0.7,
      R * 0.4,                            // attach near the body's equator
      Math.sin(angle) * R * 0.7,
    );
    // Leg points outward + slightly down. The leg's local +Y axis
    // aligns to the outward direction; we use a CylinderGeometry along
    // local +Y then rotate it to lay outward.
    const legSegment = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, LL, 5),
      legMat,
    );
    legSegment.position.y = -LL * 0.5;     // attach tip at the pivot+leg-end
    // Default cylinder is along local +Y; we want the leg to point AWAY
    // from the body's center. Rotate around Z to lay it down at the
    // angle's outward direction. Slight downward tilt (8° below
    // horizontal) for a "standing" pose.
    legSegment.rotation.z = -Math.PI / 2;
    legSegment.position.set(LL * 0.5, 0, 0);
    // Now rotate the WHOLE pivot around Y so the leg points in the
    // angle direction (not just along +X).
    legPivot.rotation.y = -angle;          // negative so +Z faces world correctly
    legPivot.add(legSegment);
    // Tip — small sphere at the end of the leg.
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), tipMat);
    tip.position.set(LL, 0, 0);
    legPivot.add(tip);
    body.add(legPivot);
    legs.push(legPivot);
  }

  return { group: root, body, legs };
}

/** Spawn a companion at a world position with an initial state. Used by
 *  both opening-scene fresh spawn and save/load restore. */
export function spawnCompanionAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  state: CompanionState = 'idle',
): Companion {
  const visual = makeCompanionVisual();
  visual.group.position.copy(pos);
  visual.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;        // AAL — enabled for ground-contact cue (cost is negligible per-mesh in modern three.js)
    }
    // Tag for raycast interaction (RMB pack-up).
    o.userData.interactType = 'pet_companion';
    o.userData.interactRegistry = 'companion';
    o.userData.interactId = 1;       // singleton — no id collision
  });
  ctx.three.scene.add(visual.group);

  const companion: Companion = {
    group: visual.group,
    body: visual.body,
    legs: visual.legs,
    pos: pos.clone(),
    heading: 0,
    state,
    stateTimer: 0,
    rollAngle: 0,
    hovered: false,
  };
  ctx.companion = companion;
  return companion;
}

/** Pack the deployed companion back into the player's inventory as a
 *  `companion_pod`. Atomic: tries addItem first; if inventory full,
 *  refuses + companion stays deployed. */
export function packUpCompanion(ctx: GameContext): boolean {
  const c = ctx.companion;
  if (!c) return false;
  const slotIdx = addItem(ctx.inventory, 'companion_pod', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag for the creature');
    return false;
  }
  ctx.three.scene.remove(c.group);
  ctx.companion = null;
  // AAO — reset huddle toast so a fresh deploy can re-trigger the moment.
  _huddleToastShown = false;
  ctx.ui.showToast('the creature curls back into its pod');
  return true;
}

/** Deploy the companion from a wielded `companion_pod` in front of the
 *  player. Returns the new Companion or null if already deployed. */
export function deployCompanion(ctx: GameContext): Companion | null {
  if (ctx.companion) {
    // Already deployed — don't double-spawn. (Could refuse + toast,
    // but the item def's onUse handles the slot decrement; we just
    // return null so the kit isn't consumed.)
    return null;
  }
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, Tuning.PLACEMENT_DISTANCE_M);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);
  return spawnCompanionAt(ctx, pos, 'idle');
}

// ─────────────────────────────────────────────────────────────────────
// Per-frame AI + animation
// ─────────────────────────────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _moveVec = new THREE.Vector3();

// AAO — one-shot toast flag for the first time the companion huddles in
// a storm. Reset on companion despawn (pod up) so a fresh deploy can
// re-trigger the moment.
let _huddleToastShown = false;
export function resetCompanionHuddleToast(): void { _huddleToastShown = false; }

export function updateCompanion(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const c = ctx.companion;
  if (!c) return;

  // ── Compute target position: beside the player, not on top of them. ──
  const ptr = ctx.player.body.body.translation();
  const playerY = ptr.y - ctx.player.eyeOffset;  // ground level under player
  // Offset target laterally — small offset toward the camera-RIGHT so
  // the creature trots to the player's side (not directly in front of
  // their viewline). Pick a stable side based on the creature's current
  // position relative to the player.
  _toPlayer.set(ptr.x - c.pos.x, 0, ptr.z - c.pos.z);
  const dist = _toPlayer.length();
  // If creature is already at the player, prevent NaN on normalize.
  if (dist > 0.01) _toPlayer.divideScalar(dist);
  // The target is the player's pos minus a small offset in the
  // direction the creature is approaching from — so the creature
  // settles beside the player, not on top.
  const followOffset = Tuning.COMPANION_FOLLOW_OFFSET_M;
  const targetX = ptr.x - _toPlayer.x * followOffset;
  const targetZ = ptr.z - _toPlayer.z * followOffset;
  const targetDist = Math.sqrt((c.pos.x - targetX) ** 2 + (c.pos.z - targetZ) ** 2);

  // ── State transitions (hysteresis on the close/far thresholds). ──
  // Use `dist` (raw player distance) for state choice so the creature
  // doesn't oscillate near the target offset.
  c.stateTimer += dt;
  const close = Tuning.COMPANION_CLOSE_DISTANCE_M;
  const far = Tuning.COMPANION_FAR_DISTANCE_M;
  let nextState: CompanionState = c.state;
  // AAO — storm-peak huddle overrides every other state. Hysteresis at
  // ±0.05 so we don't flicker around the threshold. Uses raw
  // weather.intensity (world truth) since the companion is outdoors and
  // exposed regardless of player shelter (perceivedIntensity would dampen
  // here, which is the wrong reading — see state-split shared-memory).
  const stormI = ctx.weather.intensity;
  const huddleEnter = Tuning.COMPANION_HUDDLE_THRESHOLD;
  const huddleExit = Tuning.COMPANION_HUDDLE_THRESHOLD - 0.05;
  const inHuddle = c.state === 'huddle' ? stormI > huddleExit : stormI > huddleEnter;
  if (inHuddle) {
    nextState = 'huddle';
  } else if (dist > far) {
    nextState = 'rolling';
  } else if (dist < close) {
    nextState = 'idle';
  } else {
    // In the middle band: walking. Sticky — don't flip out of idle
    // unless the player has moved away by more than CLOSE+0.5m.
    if (c.state === 'idle' && dist < close + 0.5) {
      nextState = 'idle';
    } else if (c.state === 'rolling' && dist > far - 0.5) {
      nextState = 'rolling';
    } else {
      nextState = 'walking';
    }
  }
  if (nextState !== c.state) {
    // AAO — first time entering huddle this deploy: one-shot toast so
    // the moment lands. Subsequent huddles are silent (Rocky just does
    // its thing).
    if (nextState === 'huddle' && !_huddleToastShown) {
      ctx.ui.showToast('Rocky huddles down');
      _huddleToastShown = true;
    }
    c.state = nextState;
    c.stateTimer = 0;
  }

  // ── Movement ──
  // AAO — huddle state pins the creature in place (speed = 0). Idle is
  // similar but allows the small per-frame nudge that keeps it beside
  // the player; huddle freezes completely.
  let speed = 0;
  if (c.state === 'rolling') speed = Tuning.COMPANION_ROLLING_SPEED_M_S;
  else if (c.state === 'walking') speed = Tuning.COMPANION_WALKING_SPEED_M_S;
  // Move toward target (NOT raw player) so the creature lands beside.
  if (speed > 0 && targetDist > 0.05) {
    _moveVec.set(targetX - c.pos.x, 0, targetZ - c.pos.z);
    const moveLen = _moveVec.length();
    if (moveLen > 0.001) {
      _moveVec.divideScalar(moveLen);
      // Don't overshoot the target this frame.
      const step = Math.min(speed * dt, moveLen);
      c.pos.x += _moveVec.x * step;
      c.pos.z += _moveVec.z * step;
      // Update heading toward the move direction (smoothly).
      const targetHeading = Math.atan2(_moveVec.x, _moveVec.z);
      const dh = wrapAngle(targetHeading - c.heading);
      c.heading += dh * Math.min(1, dt * 8);   // lerp at ~8 rad/s
    }
  }
  // Snap to terrain Y each frame (no gravity needed — small creature
  // hugs the ground like the lizards).
  c.pos.y = ctx.terrain.heightAt(c.pos.x, c.pos.z);

  // ── Animate per state ──
  c.group.position.copy(c.pos);
  // World Y rotation aligns the body's local +Z to heading direction.
  c.group.rotation.y = c.heading;

  if (c.state === 'rolling') {
    // Roll the body around the LATERAL axis (perpendicular to travel
    // direction). After group.rotation.y aligns +Z with heading, the
    // lateral axis is local +X. Rotate body.rotation.x accumulating
    // by speed/circumference per dt.
    const rollRate = speed / (Tuning.COMPANION_BODY_RADIUS);  // rad/s
    c.rollAngle = (c.rollAngle + rollRate * dt) % _PI2;
    c.body.rotation.x = -c.rollAngle;      // negative so top of body rolls FORWARD
    // Legs retract — hide them while rolling (body is a ball).
    for (const leg of c.legs) leg.visible = false;
    // Body bob disabled while rolling (the rotation IS the motion).
    c.body.position.y = 0;
  } else if (c.state === 'walking') {
    // Legs visible + animate gait. Each leg lifts on a sin-wave with
    // a phase offset of 2π/5 = 72° per leg (5 legs).
    c.body.rotation.x = 0;
    for (let i = 0; i < c.legs.length; i++) {
      c.legs[i].visible = true;
      const phase = (i / 5) * _PI2;
      const t = ctx.time.elapsed * Tuning.COMPANION_LEG_GAIT_FREQ_HZ * _PI2;
      // Lift = absolute sin so the leg always lifts UPWARD (not down).
      // We lift the leg pivot in local +Y (relative to the body group
      // orientation). For a more "creature-y" feel, also tilt the leg
      // slightly forward as it lifts.
      const lift = Math.max(0, Math.sin(t + phase)) * Tuning.COMPANION_LEG_GAIT_AMP;
      c.legs[i].position.y = Tuning.COMPANION_BODY_RADIUS * 0.4 + lift;
    }
    // Slight body bob with the gait — every other leg lift pulses the body.
    const t = ctx.time.elapsed * Tuning.COMPANION_LEG_GAIT_FREQ_HZ * _PI2;
    c.body.position.y = Math.sin(t) * 0.01;
  } else if (c.state === 'huddle') {
    // AAO — storm-peak huddle. Body pressed to ground, legs tucked
    // (set y=0 so they retract under the body's lowest vertex). Very
    // slow breathing bob (~1/4 the idle rate). No rotation.
    c.body.rotation.x = 0;
    for (let i = 0; i < c.legs.length; i++) {
      c.legs[i].visible = true;
      // Legs tucked beneath the body (y near 0). Slight phase-shimmer
      // for "alive but still" rather than "dead".
      const phase = (i / 5) * _PI2;
      const t = ctx.time.elapsed * 0.35 * _PI2;
      const tuck = Math.max(0, Math.sin(t + phase)) * Tuning.COMPANION_LEG_GAIT_AMP * 0.10;
      c.legs[i].position.y = tuck;
    }
    // Body pressed down — sit near ground, very small breathing bob.
    const t = ctx.time.elapsed * Tuning.COMPANION_IDLE_BOB_FREQ_HZ * 0.35 * _PI2;
    c.body.position.y = -Tuning.COMPANION_BODY_RADIUS * 0.35 + Math.sin(t) * (Tuning.COMPANION_IDLE_BOB_AMP * 0.4);
  } else {
    // Idle. Legs visible, breathing-style body bob. Legs gently
    // shimmer (small phase shift on the gait, no real lift).
    c.body.rotation.x = 0;
    for (let i = 0; i < c.legs.length; i++) {
      c.legs[i].visible = true;
      const phase = (i / 5) * _PI2;
      const t = ctx.time.elapsed * 0.7 * _PI2;
      // Small idle twitch — half-amplitude of walking gait.
      const twitch = Math.max(0, Math.sin(t + phase)) * Tuning.COMPANION_LEG_GAIT_AMP * 0.25;
      c.legs[i].position.y = Tuning.COMPANION_BODY_RADIUS * 0.4 + twitch;
    }
    // Breathing bob on the body.
    const t = ctx.time.elapsed * Tuning.COMPANION_IDLE_BOB_FREQ_HZ * _PI2;
    c.body.position.y = Math.sin(t) * Tuning.COMPANION_IDLE_BOB_AMP;
  }
  // Reference playerY so the linter / future shelter logic can use it
  void playerY;
}

/** Wrap an angle delta to (-π, π) for shortest-path lerping. */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= _PI2;
  while (a < -Math.PI) a += _PI2;
  return a;
}
