// Session ABO — A3: third-person rigged player character.
//
// Procedural primitive rig (no GLB asset per D107 zero-asset policy).
// Follows companion.ts AAE/AAZ hierarchy pattern: root → body sub-group
// for breathing bob → torso/head + per-limb pivot groups for gait
// animation. ABN D109 localSpace=true on skin material so the surface
// pattern stays anchored to the body as the player walks (avoids the
// shader-crawl bug fixed for companion/sandworm/lizard in ABN).
//
// Visibility is gated by ctx.flags.thirdPerson: rig hidden in FP (no
// body clipping into camera), visible in 3P. Viewmodel (first-person
// hands) inverts the gate (visible in FP, hidden in 3P).
//
// State machine: 'idle' | 'walking' | 'running' | 'crouching'. Chosen
// per-frame from horizontal speed magnitude + crouching flag. Animation
// is sin-wave gait keyed to ctx.time.elapsed; no physics on the limbs.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';

const _PI2 = Math.PI * 2;

export type RigState = 'idle' | 'walking' | 'running' | 'crouching';

export interface PlayerRig {
  /** Root group. Position tracks player capsule each frame. */
  group: THREE.Group;
  /** Sub-group of the body that gets translated for breathing bob. */
  body: THREE.Group;
  /** Torso mesh (capsule). */
  torso: THREE.Mesh;
  /** Head mesh (sphere). */
  head: THREE.Mesh;
  /** Per-limb pivot groups. Hips rotate around Z (gait lift), shoulders
   *  rotate around X (arm swing). Index 0=left, 1=right. */
  hips: THREE.Group[];
  shoulders: THREE.Group[];
  /** Current animation state. Drives gait freq + amplitude. */
  state: RigState;
  /** Heading (yaw) — matches camera yaw in FP, movement direction in 3P. */
  heading: number;
  /** Velocity-derived horizontal speed (m/s). Drives state classification. */
  speedMag: number;
}

/** Build the procedural player rig. Hierarchy:
 *
 *     root (world position + heading yaw via rotation.y)
 *      └─ body (vertical bob translation)
 *         ├─ torso (capsule, 0.6m tall, 0.20m radius)
 *         ├─ head (sphere, 0.18m diameter, on top of torso)
 *         ├─ hipPivot[2] (positioned at hip height ±lateral offset)
 *         │   └─ leg segment (cylinder, extends -Y from pivot)
 *         │     └─ foot (small box at the leg tip)
 *         └─ shoulderPivot[2] (positioned at shoulder height ±lateral offset)
 *             └─ arm segment (cylinder, extends -Y from pivot)
 *               └─ hand (small box at the arm tip)
 *
 *  Constants are local-only (system-internal feel-tuning lives in Tuning;
 *  per-mesh dimensions are scene-shaping numbers per D90).
 */
const TORSO_H = 0.60;
const TORSO_R = 0.20;
const HEAD_R = 0.13;
const LEG_LEN = 0.85;
const ARM_LEN = 0.65;
const HIP_LATERAL = 0.13;   // distance from spine to hip pivot
const SHOULDER_LATERAL = 0.22;
const HIP_Y = 0.85;          // hip pivot Y above feet
const SHOULDER_Y = 1.55;     // shoulder pivot Y above feet
const HEAD_Y = 1.80;
const TORSO_CENTER_Y = HIP_Y + TORSO_H / 2 + 0.05;

function buildRigVisual(): {
  group: THREE.Group;
  body: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  hips: THREE.Group[];
  shoulders: THREE.Group[];
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ABO A3 — skin material with localSpace=true per D109. Coloring is
  // dusty-coat tones (future C-customization plumbing point).
  const torsoMat = createSkinMaterial(0x8a7a5a, {
    accentColor: 0x6a5a3a,
    scaleSize: 20.0,
    sheen: 0.4,
    localSpace: true,
  });
  const limbMat = createSkinMaterial(0x5a4a3a, {
    accentColor: 0x3a2a1a,
    scaleSize: 22.0,
    sheen: 0.35,
    localSpace: true,
  });
  const headMat = createSkinMaterial(0xc0a880, {
    accentColor: 0x806648,
    scaleSize: 28.0,
    sheen: 0.55,
    localSpace: true,
  });

  // Torso — capsule (cylinder + 2 hemispheres) via 3-mesh composite.
  // Three.js has no built-in CapsuleGeometry across all versions; use a
  // cylinder + two spheres for portable code.
  const torsoCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(TORSO_R, TORSO_R * 0.85, TORSO_H, 12),
    torsoMat,
  );
  torsoCyl.position.y = TORSO_CENTER_Y;
  body.add(torsoCyl);
  const torsoCapTop = new THREE.Mesh(
    new THREE.SphereGeometry(TORSO_R, 12, 8, 0, _PI2, 0, Math.PI / 2),
    torsoMat,
  );
  torsoCapTop.position.y = TORSO_CENTER_Y + TORSO_H / 2;
  body.add(torsoCapTop);
  const torsoCapBot = new THREE.Mesh(
    new THREE.SphereGeometry(TORSO_R * 0.85, 12, 8, 0, _PI2, Math.PI / 2, Math.PI / 2),
    torsoMat,
  );
  torsoCapBot.position.y = TORSO_CENTER_Y - TORSO_H / 2;
  body.add(torsoCapBot);

  // Head — sphere on a short neck stub
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R, 14, 10),
    headMat,
  );
  head.position.y = HEAD_Y;
  body.add(head);
  // Neck stub — thin cylinder so the head isn't floating
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8),
    headMat,
  );
  neck.position.y = HEAD_Y - HEAD_R - 0.04;
  body.add(neck);

  // Hips — 2 leg pivots at ±HIP_LATERAL
  const hips: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * HIP_LATERAL, HIP_Y, 0);
    body.add(hipPivot);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.058, LEG_LEN, 8),
      limbMat,
    );
    leg.position.y = -LEG_LEN / 2;
    hipPivot.add(leg);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.05, 0.18),
      limbMat,
    );
    foot.position.set(0, -LEG_LEN - 0.02, 0.05);
    hipPivot.add(foot);
    hips.push(hipPivot);
  }

  // Shoulders — 2 arm pivots at ±SHOULDER_LATERAL
  const shoulders: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * SHOULDER_LATERAL, SHOULDER_Y, 0);
    body.add(shoulderPivot);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.042, ARM_LEN, 8),
      limbMat,
    );
    arm.position.y = -ARM_LEN / 2;
    shoulderPivot.add(arm);
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.10, 0.06),
      limbMat,
    );
    hand.position.y = -ARM_LEN - 0.02;
    shoulderPivot.add(hand);
    shoulders.push(shoulderPivot);
  }

  return { group: root, body, torso: torsoCyl, head, hips, shoulders };
}

/** Build the player rig + spawn it into the scene. Initially invisible
 *  (3P mode off at boot). */
export function buildPlayerRig(ctx: GameContext): PlayerRig {
  const visual = buildRigVisual();
  visual.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  // FP at boot — rig hidden until F-key toggles 3P.
  visual.group.visible = false;
  ctx.three.scene.add(visual.group);

  const rig: PlayerRig = {
    group: visual.group,
    body: visual.body,
    torso: visual.torso,
    head: visual.head,
    hips: visual.hips,
    shoulders: visual.shoulders,
    state: 'idle',
    heading: 0,
    speedMag: 0,
  };
  return rig;
}

/** Per-frame update: position + heading + state classification + gait. */
export function updatePlayerRig(ctx: GameContext, dt: number): void {
  void dt;
  const rig = ctx.player.rig;
  if (!rig) return;

  // Visibility gate — only sync transforms when visible (saves a tiny
  // amount of work in FP, more importantly keeps state stable).
  rig.group.visible = ctx.flags.thirdPerson;
  if (!rig.group.visible) return;

  // Position — player capsule's translation is at the player's CENTER,
  // not feet. eyeOffset is camera offset from center. Feet are at
  // capsule.y - (capsuleHalfHeight + capsuleRadius). For the simple
  // rig case, plant the rig's feet at the body translation minus
  // eyeOffset (eyeOffset is from body-center to eye; player feet sit
  // ~half-body-height below center). Use a conservative offset.
  const tr = ctx.player.body.body.translation();
  const feetY = tr.y - ctx.player.eyeOffset - 0.5;  // feet ~0.5m below eyes
  rig.group.position.set(tr.x, feetY, tr.z);

  // Heading — face the camera's horizontal direction. Camera owns yaw
  // via pointer-lock; rig follows.
  const cam = ctx.three.camera;
  const camDir = new THREE.Vector3();
  cam.getWorldDirection(camDir);
  camDir.y = 0;
  if (camDir.lengthSq() > 1e-4) {
    rig.heading = Math.atan2(camDir.x, camDir.z);
  }
  rig.group.rotation.y = rig.heading;

  // Speed magnitude — derive from Rapier linvel projected onto XZ.
  const lv = ctx.player.body.body.linvel();
  rig.speedMag = Math.sqrt(lv.x * lv.x + lv.z * lv.z);

  // State classification
  const speedRun = Tuning.WALK_SPEED * Tuning.SPRINT_MULTIPLIER * 0.85;
  if (ctx.player.crouching) {
    rig.state = 'crouching';
  } else if (rig.speedMag < 0.15) {
    rig.state = 'idle';
  } else if (rig.speedMag < speedRun) {
    rig.state = 'walking';
  } else {
    rig.state = 'running';
  }

  // Animate per state
  const t = ctx.time.elapsed;
  if (rig.state === 'walking' || rig.state === 'running') {
    const gaitFreq = rig.state === 'walking' ? 1.6 : 2.4;   // Hz
    const phase = t * gaitFreq * _PI2;
    // Hip rotation around Z (lift); ±0.4 rad walking, ±0.55 rad running
    const hipAmp = rig.state === 'walking' ? 0.4 : 0.55;
    rig.hips[0].rotation.x = Math.sin(phase) * hipAmp;
    rig.hips[1].rotation.x = Math.sin(phase + Math.PI) * hipAmp;
    // Arm swing — opposite phase to legs, slightly smaller amplitude
    const armAmp = hipAmp * 0.8;
    rig.shoulders[0].rotation.x = Math.sin(phase + Math.PI) * armAmp;
    rig.shoulders[1].rotation.x = Math.sin(phase) * armAmp;
    // Body bob — small vertical sine at 2× gait freq
    rig.body.position.y = Math.abs(Math.sin(phase)) * 0.035;
  } else if (rig.state === 'crouching') {
    // Crouch: legs slightly bent forward, body lowered, arms hang
    rig.hips[0].rotation.x = 0.5;
    rig.hips[1].rotation.x = 0.5;
    rig.shoulders[0].rotation.x = 0.1;
    rig.shoulders[1].rotation.x = 0.1;
    rig.body.position.y = -0.35;
  } else {
    // Idle — gentle breathing bob, arms hang slightly forward
    const bobPhase = t * 0.8 * _PI2;
    rig.body.position.y = Math.sin(bobPhase) * 0.012;
    rig.hips[0].rotation.x = 0;
    rig.hips[1].rotation.x = 0;
    rig.shoulders[0].rotation.x = 0.08;
    rig.shoulders[1].rotation.x = 0.08;
  }
}
