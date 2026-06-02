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
import { createSkinMaterial } from '../world/skinMaterial.ts';
import { addItem } from '../inventory/inventory.ts';
import { alignToTerrain } from '../util/terrainAlign.ts';
import { getPlayerPos } from '../util/playerPos.ts';

// AAO — `huddle` added. At storm peak (`weather.intensity > HUDDLE_THRESHOLD`)
// the companion overrides any far/close logic and presses to the ground
// with legs tucked. Reads as "Rocky is weathering the storm with you."
export type CompanionState = 'rolling' | 'walking' | 'idle' | 'huddle';

export interface Companion {
  /** Root group. Position tracks the creature's world location each frame. */
  group: THREE.Group;
  /** Sub-group of body + legs that's translated per state (breathing bob,
   *  huddle press-down). Origin sits at the creature's ground position. */
  body: THREE.Group;
  /** AAZ-fix — inner sub-group whose origin is at the body's CENTER
   *  (y=R inside the body group's frame). The body sphere + eye live
   *  inside this; rolling-state rotation is applied here so the ball
   *  pivots around its own center, not the body group's origin (which
   *  sits at the creature's feet). Pre-AAZ-fix the roll rotated the body
   *  group itself, making the sphere orbit the ground point — the visual
   *  read as "creature bobbing into and out of the sand", not rolling. */
  bodyShell: THREE.Group;
  /** Each leg's outer pivot (positioned at the body surface, yawed to
   *  point radially outward). Visibility is toggled here for rolling. */
  legs: THREE.Group[];
  /** AAZ-fix — each leg's inner hip pivot. Rotates around its local Z
   *  axis to lift the leg in a walk cycle. Pre-AAZ-fix the legs translated
   *  vertically as a unit, which read as the legs floating flat under
   *  the body instead of pivoting at the body attachment. */
  hips: THREE.Group[];
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

// Session ABA — alignCompanionToTerrain + its module-level scratch
// vectors deleted; the shared helper (with the same scratch-vector
// allocator pattern internally so per-frame callers pay no GC) lives
// in src/util/terrainAlign.ts now. Imported at top of file.

/** Build the creature's visual. Returns the root group + bodyShell +
 *  per-leg outer pivots + per-leg inner hip pivots so the AI can
 *  animate them per state.
 *
 *  AAZ-fix hierarchy (bottom-up):
 *
 *     root (world position, world yaw via rotation.y)
 *      └─ body (vertical bob/press-down translation)
 *         ├─ bodyShell (positioned at y=R; rolling rotation pivots HERE
 *         │   so the sphere orbits its own center, not the ground)
 *         │   ├─ main carapace (centered at shell origin)
 *         │   ├─ inner shadow shell
 *         │   ├─ eye + glint
 *         │   └─ ...
 *         └─ legPivot[5] (at body equator surface, yawed to point
 *             radially outward)
 *             └─ hipGroup (rotates around its Z axis = body's
 *                 tangential axis at this leg → swings the leg up/down
 *                 in the radial-vertical plane)
 *                 ├─ leg segment (along hipGroup local +X)
 *                 └─ tip sphere
 */
function makeCompanionVisual(): {
  group: THREE.Group;
  body: THREE.Group;
  bodyShell: THREE.Group;
  legs: THREE.Group[];
  hips: THREE.Group[];
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const R = Tuning.COMPANION_BODY_RADIUS;
  const LL = Tuning.COMPANION_LEG_LENGTH;
  const REST_DOWN = Tuning.COMPANION_LEG_REST_ANGLE_RAD;
  // AAZ-fix-2 — leg attachment moved BELOW the equator so short legs
  // (LL=0.14) can still reach the ground at the resting down-angle.
  // The attachment Y is exactly the vertical leg span at rest, so the
  // tip sits on the ground (y=0 inside body frame); the attachment
  // radial is the body's horizontal cross-section at that Y (= ON the
  // sphere surface). Clamped to a small offset from body top so the
  // legs never originate at the apex.
  const ATTACH_Y = Math.min(R * 0.92, LL * Math.sin(REST_DOWN));
  const ON_SURFACE_RADIAL = Math.sqrt(Math.max(0, R * R - (R - ATTACH_Y) * (R - ATTACH_Y)));
  // AAZ-fix-3 — pull the pivot slightly inside the body sphere so the
  // leg's inner end visibly EMBEDS into the carapace instead of
  // hovering off the surface. Pre-AAZ-fix-3 a 1cm-radius cylinder
  // meeting a curving sphere surface read as a small gap (the cylinder
  // is straight, the sphere falls away); recessing the pivot ~3cm
  // makes the inner end disappear into the body silhouette.
  const ATTACH_RECESS_M = 0.03;
  const ATTACH_RADIAL = Math.max(0.02, ON_SURFACE_RADIAL - ATTACH_RECESS_M);

  // bodyShell — origin AT body center (y=R inside body group). All body
  // meshes parent to it at y=0 (their own centers coincide with the
  // shell's origin), so when rolling rotates the shell, the meshes
  // orbit the shell's center, not the ground.
  const bodyShell = new THREE.Group();
  bodyShell.position.y = R;
  body.add(bodyShell);

  // Body materials — IcosahedronGeometry with flat-shading reads as a
  // rocky crystalline carapace. ABH — gets the skin shader (treated
  // as a living crystalline creature; high sheen + tight scale cells
  // sells the crystalline scale plates).
  // ABN — localSpace anchors the noise pattern to the body so the
  // crystalline scale plates don't crawl across the carapace when Rocky
  // walks/rolls. Without this, world-space sampling re-evaluates the
  // pigment + cell pattern at the body's new position each frame.
  const bodyMat = createSkinMaterial(Tuning.COMPANION_COLOR_HEX, {
    accentColor: Tuning.COMPANION_DARK_COLOR_HEX,
    scaleSize: 18.0,
    sheen: 0.85,
    localSpace: true,
  });
  const darkMat = createSkinMaterial(Tuning.COMPANION_DARK_COLOR_HEX, {
    scaleSize: 18.0,
    sheen: 0.65,
    localSpace: true,
  });
  // Main carapace — centered at the shell origin (so rolls cleanly).
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 0), bodyMat);
  bodyShell.add(main);
  // Inner darker shell, slightly oblate, offset down a hair for shadow.
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.85, 0), darkMat);
  inner.position.y = -0.01;
  inner.scale.set(1, 0.9, 1);
  bodyShell.add(inner);

  // Eye — small dark dot at the body "front" (+Z local). Sits slightly
  // above equator within the shell.
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x140808 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
  eye.position.set(0, R * 0.25, R * 0.92);
  bodyShell.add(eye);
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xf0e8d0 });
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), glintMat);
  glint.position.set(0.01, R * 0.35, R * 0.95);
  bodyShell.add(glint);

  // 5 radial legs. Each consists of an OUTER pivot (positioned at the
  // body surface + yawed to face outward) and an INNER hip pivot
  // (rotates around its Z axis for the gait lift). The leg segment +
  // tip live inside the hip group, extending along local +X.
  const legs: THREE.Group[] = [];
  const hips: THREE.Group[] = [];
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
    // AAZ-fix-2 — attach BELOW the equator (at ATTACH_Y / ATTACH_RADIAL
    // computed above) so the short legs can reach the ground at the
    // resting down-angle. Visually: the legs come out of the lower
    // half of the body sphere, like crab legs.
    legPivot.position.set(
      Math.cos(angle) * ATTACH_RADIAL,
      ATTACH_Y,
      Math.sin(angle) * ATTACH_RADIAL,
    );
    // Yaw the pivot so its local +X points radially outward from the
    // body. Negative so the leg's "front" (eye direction) maps to world
    // +Z when angle=0.
    legPivot.rotation.y = -angle;
    body.add(legPivot);

    // Hip group: rotates around its local Z (after the pivot's Y
    // rotation, this is the tangential direction at the leg's body
    // attachment). Rotating -REST_DOWN puts the leg's +X axis (along
    // which the segment extends) tilted downward, making the tip touch
    // the ground. The walk-gait animation modulates this rotation.
    const hipGroup = new THREE.Group();
    hipGroup.rotation.z = -REST_DOWN;
    legPivot.add(hipGroup);

    // Leg segment: cylinder along the hip group's local +X (the leg's
    // "outward" direction after the down-tilt).
    const legSegment = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, LL, 5),
      legMat,
    );
    legSegment.rotation.z = -Math.PI / 2;     // cylinder's +Y axis → local +X
    legSegment.position.set(LL * 0.5, 0, 0);
    hipGroup.add(legSegment);

    // Tip — small sphere at the end of the leg (foot pad / claw).
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), tipMat);
    tip.position.set(LL, 0, 0);
    hipGroup.add(tip);

    legs.push(legPivot);
    hips.push(hipGroup);
  }

  return { group: root, body, bodyShell, legs, hips };
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
    bodyShell: visual.bodyShell,
    legs: visual.legs,
    hips: visual.hips,
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
    ctx.ui.showToast('no room in your bag for Pebble');
    return false;
  }
  ctx.three.scene.remove(c.group);
  ctx.companion = null;
  // AAO — reset huddle toast so a fresh deploy can re-trigger the moment.
  _huddleToastShown = false;
  ctx.ui.showToast('Pebble curls back into its pod');
  return true;
}

/** ACV (#Cycle 7) — remove the deployed companion from the world WITHOUT
 *  granting a pod (distinct from packUpCompanion). Used by the boot reconcile
 *  for a NEW game where the companion hasn't been hatched yet — the boot
 *  always spawns the companion (so a Continue can patch it), and this undoes
 *  that spawn when `flags.companionAcquired` is false. */
export function despawnCompanion(ctx: GameContext): void {
  const c = ctx.companion;
  if (!c) return;
  ctx.three.scene.remove(c.group);
  ctx.companion = null;
  _huddleToastShown = false;
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

// B1 Phase 2 — getPlayerPos lifted to src/util/playerPos.ts (3rd consumer:
// rope endpoint resolver triggered the lift, alongside sandWorm.ts). Old
// ABN-era duplicate copy here removed; import from shared util.

export function updateCompanion(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const c = ctx.companion;
  if (!c) return;

  // ── Compute target position: beside the player, not on top of them. ──
  const ptr = getPlayerPos(ctx);
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
      ctx.ui.showToast('Pebble huddles down');
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
  // AAZ-fix-2 — orient the body to BOTH the heading direction AND the
  // terrain slope. Pre-AAZ-fix-2 used `c.group.rotation.y = c.heading`,
  // which kept the body vertical regardless of slope — on a dune ramp
  // the creature looked like it was floating instead of standing on
  // the ground. The terrain-align helper samples 4 cardinal heights at
  // a body-radius scale and tilts the body so its local +Y matches the
  // terrain normal while local +Z still points along the heading.
  alignToTerrain(
    c.group,
    ctx.terrain,
    c.pos.x,
    c.pos.z,
    c.heading,
    Tuning.COMPANION_BODY_RADIUS * 1.2,
  );

  // AAZ-fix — per-state animation. Common pre-loop state resets:
  //   bodyShell.rotation.x → 0 (unless rolling)
  //   body.position.y → 0 (unless an explicit bob/press-down sets it)
  //   hips[i].rotation.z → -REST_DOWN (unless lifted)
  // Each branch sets only what it needs to.
  const REST = Tuning.COMPANION_LEG_REST_ANGLE_RAD;
  const LIFT = Tuning.COMPANION_LEG_LIFT_ANGLE_RAD;

  if (c.state === 'rolling') {
    // Roll the bodyShell around the LATERAL axis (perpendicular to
    // travel direction). After group.rotation.y aligns +Z with heading,
    // the lateral axis in body-local space is +X. Accumulating roll =
    // speed / circumference per dt.
    //
    // AAZ-fix — rotate `bodyShell` (origin at body center, y=R) instead
    // of `body` (origin at ground). Pre-AAZ-fix the ball orbited the
    // ground point, so it dipped below + rose above the sand each cycle
    // — the user read this as "bobbing up and down in the sand", which
    // it literally was.
    const rollRate = speed / Tuning.COMPANION_BODY_RADIUS;  // rad/s
    c.rollAngle = (c.rollAngle + rollRate * dt) % _PI2;
    c.bodyShell.rotation.x = -c.rollAngle;
    // Legs retract — hidden while rolling.
    for (const leg of c.legs) leg.visible = false;
    // No vertical bob in rolling state.
    c.body.position.y = 0;
  } else if (c.state === 'walking') {
    c.bodyShell.rotation.x = 0;
    // Animate each leg's hip rotation around its Z axis (the tangential
    // axis at the leg's body attachment). Each leg lifts on a sin-wave
    // with a 72° phase offset (2π/5 across the 5 legs) so the body
    // always has some feet planted.
    const t = ctx.time.elapsed * Tuning.COMPANION_LEG_GAIT_FREQ_HZ * _PI2;
    for (let i = 0; i < c.legs.length; i++) {
      c.legs[i].visible = true;
      const phase = (i / 5) * _PI2;
      // Lift in [0, 1] — only positive sin lobe so the leg always lifts
      // UPWARD from rest, never plunges into the ground.
      const lift = Math.max(0, Math.sin(t + phase));
      // Rotation: rest is -REST; lift adds toward 0 (horizontal).
      c.hips[i].rotation.z = -REST + lift * LIFT;
    }
    // Subtle body bob in time with the gait.
    c.body.position.y = Math.sin(t) * 0.012;
  } else if (c.state === 'huddle') {
    // AAO — storm-peak huddle. Body pressed to ground, legs tucked
    // (rotated almost straight down so they shorten visually + hide
    // under the body's lowest vertex). Slow breathing bob (~1/3 idle rate).
    c.bodyShell.rotation.x = 0;
    const t = ctx.time.elapsed * 0.35 * _PI2;
    for (let i = 0; i < c.legs.length; i++) {
      c.legs[i].visible = true;
      const phase = (i / 5) * _PI2;
      // Tuck: rotate the hip past rest so the leg points more steeply
      // downward. Slight per-leg shimmer so the huddle reads as
      // "alive but still" rather than "dead".
      const shimmer = Math.max(0, Math.sin(t + phase)) * 0.06;
      c.hips[i].rotation.z = -(REST + 0.55) + shimmer;
    }
    // Body pressed down.
    const tBob = ctx.time.elapsed * Tuning.COMPANION_IDLE_BOB_FREQ_HZ * 0.35 * _PI2;
    c.body.position.y =
      -Tuning.COMPANION_BODY_RADIUS * 0.35 +
      Math.sin(tBob) * (Tuning.COMPANION_IDLE_BOB_AMP * 0.4);
  } else {
    // Idle. Legs visible, hips at rest with tiny shimmer; breathing bob
    // on the body group.
    c.bodyShell.rotation.x = 0;
    const t = ctx.time.elapsed * 0.7 * _PI2;
    for (let i = 0; i < c.legs.length; i++) {
      c.legs[i].visible = true;
      const phase = (i / 5) * _PI2;
      // Small twitch — ~10% of walking lift amplitude.
      const twitch = Math.max(0, Math.sin(t + phase)) * LIFT * 0.10;
      c.hips[i].rotation.z = -REST + twitch;
    }
    const tBob = ctx.time.elapsed * Tuning.COMPANION_IDLE_BOB_FREQ_HZ * _PI2;
    c.body.position.y = Math.sin(tBob) * Tuning.COMPANION_IDLE_BOB_AMP;
  }
  // Reference playerY so the linter / future shelter logic can use it.
  void playerY;
}

/** Wrap an angle delta to (-π, π) for shortest-path lerping. */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= _PI2;
  while (a < -Math.PI) a += _PI2;
  return a;
}
