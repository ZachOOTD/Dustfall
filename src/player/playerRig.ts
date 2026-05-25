// Session ABO — A3: third-person rigged player character.
// Session ABP — overhauled: proportions + procedural clothing layers
// (mismatched-scavenger aesthetic per docs/research/sci-fi-desert-
// scavenger-aesthetic.md) + knee/elbow sub-pivots (Tier 2 setup).
//
// Procedural primitive rig (no GLB asset per D107 zero-asset policy).
// Aesthetic anchor: mismatched scavenger (Cobb Vanth / Tatooine spacer
// / Star Wars Outlaws). Layered scrap: hood + poncho + bandolier with
// pouches + asymmetric right pauldron + face bandana + (stretch)
// forearm wraps + chest plate + goggles.
//
// Visibility is gated by ctx.flags.thirdPerson: rig hidden in FP (no
// body clipping into camera), visible in 3P. Viewmodel (first-person
// hands) inverts the gate.
//
// State machine: 'idle' | 'walking' | 'running' | 'crouching'. Chosen
// per-frame from horizontal speed + crouching flag. Animation is
// sin-wave gait keyed to ctx.time.elapsed; no physics on the limbs.
//
// Hierarchy (ABP):
//   root (world position + heading yaw via rotation.y)
//    └─ body (vertical bob translation)
//       ├─ torso (chest + waist + head + neck)
//       ├─ poncho group (cosmetic, doesn't track limbs)
//       │   ├─ poncho body (tapered open cylinder)
//       │   └─ bandolier (strap + pouches)
//       ├─ head group (rotates with head; bandana + hood inside)
//       ├─ hipPivot[2] (rotates X for gait lift)
//       │   ├─ upper leg
//       │   └─ kneeGroup (rotates X for knee flex)
//       │       ├─ lower leg
//       │       └─ foot (with toe)
//       └─ shoulderPivot[2] (rotates X for arm swing)
//           ├─ upper arm
//           ├─ pauldron (RIGHT shoulder ONLY — D-entry candidate)
//           ├─ forearm wraps (stretch)
//           └─ elbowGroup (rotates X for elbow bend)
//               ├─ forearm
//               └─ hand (with fingers + thumb)

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';
import { createFabricMaterial } from '../world/fabricMaterial.ts';
import { createMetalMaterial } from '../world/metalMaterial.ts';
import { createPaintedMetalMaterial } from '../world/paintMaterial.ts';

const _PI2 = Math.PI * 2;

export type RigState = 'idle' | 'walking' | 'running' | 'crouching';

export interface PlayerRig {
  /** Root group. Position tracks player capsule each frame. */
  group: THREE.Group;
  /** Sub-group of the body that gets translated for breathing bob. */
  body: THREE.Group;
  /** Head sub-group — rotates independently for head-bob counter +
   *  future head-yaw lag (Tier 2). Contains head mesh, neck, bandana, hood. */
  headGroup: THREE.Group;
  /** Per-limb pivot groups. Hips rotate around X (gait lift), shoulders
   *  rotate around X (arm swing). Index 0=left, 1=right. */
  hips: THREE.Group[];
  shoulders: THREE.Group[];
  /** ABP — knee sub-pivots inside each hip; rotate around X for knee flex
   *  during 3-phase walk cycle. */
  knees: THREE.Group[];
  /** ABP — elbow sub-pivots inside each shoulder; rotate around X for
   *  elbow bend during arm swing + aim-IK (Tier 5). */
  elbows: THREE.Group[];
  /** ABP — right-hand world attachment point for 3P held items (Tier 4). */
  rightHandAttach: THREE.Group;
  /** Current animation state. */
  state: RigState;
  /** Heading (yaw) — matches camera yaw in FP, movement direction in 3P. */
  heading: number;
  /** Velocity-derived horizontal speed (m/s). Drives state classification. */
  speedMag: number;
}

// ── Proportions (m) — slight tune toward more-human silhouette ──
const TORSO_CHEST_R = 0.22;     // upper torso wider for shoulders
const TORSO_WAIST_R = 0.16;     // waist narrower
const TORSO_H = 0.62;
const HEAD_R = 0.12;
const HEAD_SCALE_Y = 1.15;       // elongated oval
const NECK_R = 0.055;
const NECK_H = 0.10;
const LEG_LEN = 0.85;
const UPPER_LEG_LEN = 0.45;
const LOWER_LEG_LEN = LEG_LEN - UPPER_LEG_LEN;
const ARM_LEN = 0.65;
const UPPER_ARM_LEN = 0.32;
const LOWER_ARM_LEN = ARM_LEN - UPPER_ARM_LEN;
const HIP_LATERAL = 0.12;
const SHOULDER_LATERAL = 0.22;
const HIP_Y = 0.85;
const SHOULDER_Y = 1.52;
const HEAD_Y = 1.78;
const TORSO_CENTER_Y = HIP_Y + TORSO_H / 2 + 0.04;

// ── Color palette (per docs/research/sci-fi-desert-scavenger-aesthetic.md) ──
const SKIN_COLOR = 0xc9a876;           // weathered tan
const SKIN_ACCENT = 0x8a7048;          // shadow tone
const PONCHO_COLOR = 0xd9a85a;         // ABP-polish R4: 0xb8860b read as dark brown after fabricMaterial multipliers; bumped to lighter golden ochre for the actual "sun-bleached" silhouette
const HOOD_COLOR = 0xd2b48c;           // desert tan (lighter than poncho)
const BANDANA_COLOR = 0x3a3a3a;        // dark cloth
const STRAP_COLOR = 0x505050;          // dark metal/leather
const POUCH_RUST = 0xa0522d;           // rust-orange
const PAULDRON_METAL = 0x6a6a6a;       // dark grey metal
const PAULDRON_RUST = 0x8a4a28;        // chipped paint reveals rust
const WRAP_COLOR = 0x7a7a7a;           // warm grey (forearm wraps)

function buildRigVisual(): {
  group: THREE.Group;
  body: THREE.Group;
  headGroup: THREE.Group;
  hips: THREE.Group[];
  shoulders: THREE.Group[];
  knees: THREE.Group[];
  elbows: THREE.Group[];
  rightHandAttach: THREE.Group;
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ── Materials ──
  // Skin: face + hands. localSpace=true per D109 (moving entity).
  const skinMat = createSkinMaterial(SKIN_COLOR, {
    accentColor: SKIN_ACCENT,
    scaleSize: 26.0,
    sheen: 0.5,
    localSpace: true,
  });
  // Torso/limbs under poncho — same skin tone but slightly darker
  // (shadows under cloth). Player can't see most of this; the cloth
  // covers it. Keeps the rig recognisable in any cloth-strip edge case.
  const underclothMat = createSkinMaterial(0x6a5a3a, {
    accentColor: 0x4a3a26,
    scaleSize: 22.0,
    sheen: 0.3,
    localSpace: true,
  });
  // Cloth layers — fabric shader with disableShimmer (rig is a moving
  // entity; shimmer would crawl per ABN/D109 sibling pattern).
  const ponchoMat = createFabricMaterial(PONCHO_COLOR, undefined, { disableShimmer: true });
  const hoodMat = createFabricMaterial(HOOD_COLOR, undefined, { disableShimmer: true });
  const bandanaMat = createFabricMaterial(BANDANA_COLOR, undefined, { disableShimmer: true });
  const wrapMat = createFabricMaterial(WRAP_COLOR, undefined, { disableShimmer: true });
  // Metal: bandolier strap + pauldron base
  const strapMat = createMetalMaterial(STRAP_COLOR, { wornScale: 14.0, scratchStrength: 0.06 });
  const pauldronMetalMat = createMetalMaterial(PAULDRON_METAL, { wornScale: 9.0, scratchStrength: 0.10 });
  // Painted-corroded: pouches + pauldron plates (chipped paint over rust)
  const pouchPaintMat = createPaintedMetalMaterial(POUCH_RUST, { wearLevel: 0.6 });
  const pauldronPaintMat = createPaintedMetalMaterial(PAULDRON_RUST, { wearLevel: 0.7 });

  // ── Torso: ORGANIC LATHE (ABS R1) ──
  // Pre-ABS: 4-piece composite (2 cylinders + 2 sphere caps) read as
  // "two cans stacked". Replaced with a single LatheGeometry from a
  // profile curve hand-crafted to read as a human torso silhouette:
  //   neck base → shoulder line → chest swell → ribcage taper → waist
  //   narrow → hip flare → crotch.
  // Profile sampled at 9 keypoints in TORSO_LOCAL_Y space (relative to
  // TORSO_CENTER_Y). Radial segments=24 for smooth read.
  // ABS R4: profile refined for more organic contours. Pectoral swell
  // pushed wider (1.18× instead of 1.08×); ribcage taper to waist
  // sharper; hip line more flared; smoother neck-base transition (add
  // intermediate point to avoid hard lip).
  const torsoProfile = [
    // [radial, y-offset-from-center]
    new THREE.Vector2(0.0, +0.395),     // CAP top
    new THREE.Vector2(0.060, +0.380),   // neck-base smooth shoulder
    new THREE.Vector2(0.105, +0.360),   // neck base
    new THREE.Vector2(TORSO_CHEST_R * 1.05, +0.330),    // shoulder line (widest top)
    new THREE.Vector2(TORSO_CHEST_R * 1.18, +0.230),    // upper chest (pectoral SWELL)
    new THREE.Vector2(TORSO_CHEST_R * 1.15, +0.140),    // pec curve under
    new THREE.Vector2(TORSO_CHEST_R * 1.04, +0.040),    // mid chest (sternum)
    new THREE.Vector2(TORSO_CHEST_R * 0.88, -0.060),    // lower ribcage taper
    new THREE.Vector2(TORSO_WAIST_R * 0.98, -0.150),    // natural waist (narrow)
    new THREE.Vector2(TORSO_WAIST_R * 1.10, -0.220),    // upper hip
    new THREE.Vector2(TORSO_WAIST_R * 1.35, -0.280),    // hip line (flared)
    new THREE.Vector2(TORSO_WAIST_R * 1.20, -0.330),    // upper thigh attach
    new THREE.Vector2(0.10, -0.380),                    // crotch
    new THREE.Vector2(0.0, -0.395),                     // CAP bottom
  ];
  // ABS R3: DoubleSide so the interior wall renders too — through the
  // open V of the poncho the camera sees inside-of-back-wall otherwise.
  // Cost is negligible (same shader runs both faces; this is a small
  // mesh ~250 tris).
  const torsoLatheMat = underclothMat.clone();
  torsoLatheMat.side = THREE.DoubleSide;
  const torsoMesh = new THREE.Mesh(
    new THREE.LatheGeometry(torsoProfile, 24),
    torsoLatheMat,
  );
  torsoMesh.position.y = TORSO_CENTER_Y;
  body.add(torsoMesh);

  // ── Head: elongated oval + face plane + neck ──
  const headGroup = new THREE.Group();
  headGroup.position.y = HEAD_Y;
  body.add(headGroup);
  // Head shape: sphere with non-uniform scale for elongated read
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R, 16, 12),
    skinMat,
  );
  head.scale.set(1.0, HEAD_SCALE_Y, 0.95);
  headGroup.add(head);
  // Face flat plane (jaw line read) — small box pressed into face front
  const jawline = new THREE.Mesh(
    new THREE.BoxGeometry(HEAD_R * 1.4, HEAD_R * 0.4, 0.04),
    skinMat,
  );
  jawline.position.set(0, -HEAD_R * 0.35, HEAD_R * 0.85);
  headGroup.add(jawline);
  // Tiny ear bumps (sells "real head" silhouette from 3P)
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skinMat);
    ear.position.set(sx * (HEAD_R * 0.92), 0.01, 0);
    headGroup.add(ear);
  }
  // Neck — real cylinder (was a 4cm stub pre-ABP)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(NECK_R, NECK_R * 1.15, NECK_H, 10),
    skinMat,
  );
  neck.position.y = -HEAD_R * HEAD_SCALE_Y - NECK_H / 2 + 0.02;
  headGroup.add(neck);

  // ── Bandana: torus around lower face (covers mouth + nose) ──
  const bandana = new THREE.Mesh(
    new THREE.TorusGeometry(HEAD_R * 0.85, 0.025, 6, 16),
    bandanaMat,
  );
  bandana.position.set(0, -HEAD_R * 0.25, HEAD_R * 0.15);
  bandana.rotation.x = Math.PI / 2;
  bandana.scale.set(1.0, 0.85, 0.55);     // flatten + push back to wrap face
  headGroup.add(bandana);

  // ── Hood: hemisphere crown + back-half drape (ABP-polish R1).
  // Pre-polish was ConeGeometry apex-up = wizard hat silhouette. Now:
  //   1. Upper-hemisphere crown sitting OVER the head (phi 0..0.55π)
  //   2. Partial cylinder back drape covering ~180° of the back+sides,
  //      open at the FRONT so the face reads. thetaStart=π (left ear),
  //      thetaLength=π → cylinder occupies [180°, 360°] going through
  //      the back (270°), leaving the front half open.
  // ABP-polish R3: phiLength shrunk 0.55π → 0.42π so crown ends ABOVE
  // brow (forehead visible). Crown also raised slightly + radius 1.30 →
  // 1.22 for a tighter cap. Drape's front opening widened so face fully
  // reads from front; drape top brought forward 0.05 to peek over brow.
  const hoodCrown = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R * 1.22, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
    hoodMat,
  );
  hoodCrown.position.y = HEAD_R * 0.18;
  headGroup.add(hoodCrown);
  // Drape: [225°, 315°] = back-only 90° (was 180° back+sides which covered
  // the cheeks). Front + sides now open so face + bandana read.
  const hoodDrape = new THREE.Mesh(
    new THREE.CylinderGeometry(
      HEAD_R * 1.25, HEAD_R * 1.55,
      HEAD_R * 1.80,
      14, 1, true,
      Math.PI * 1.25, Math.PI * 0.50,    // [225°, 315°] = back only
    ),
    hoodMat,
  );
  hoodDrape.position.y = -HEAD_R * 0.55;
  headGroup.add(hoodDrape);

  // ── Poncho: tapered open cylinder draping shoulders to upper hip ──
  // thetaLength less than 2π for open sides (mismatched-scavenger feel
  // per research; doesn't fully wrap the body).
  // ABQ R1: shrunk from barrel (1.25/2.0/1.4) → shawl. Top radius now
  // tighter than chest so arms hang OUTSIDE the silhouette; bottom
  // flare gentle (1.4× not 2×); height = 0.85× torso so legs are
  // visible below the hem (was reaching mid-thigh and hiding feet).
  // ABQ R2: hem flare bumped 1.4 → 1.6 for a more visible "draped cloth"
  // read (R1's 1.4 was correct shape but read as a tube at distance).
  const ponchoR_top = TORSO_CHEST_R * 1.08;
  const ponchoR_bot = TORSO_WAIST_R * 1.6;     // hem flare — drape reads
  const ponchoH = TORSO_H * 0.85;              // shoulder to upper-hip
  const poncho = new THREE.Mesh(
    new THREE.CylinderGeometry(
      ponchoR_top, ponchoR_bot, ponchoH,
      16, 1, true,             // open-ended (no caps); +2 segments for smoother taper
      Math.PI * 0.15, Math.PI * 1.7,   // ~3/4 wrap; opens toward +X side
    ),
    ponchoMat,
  );
  poncho.position.y = TORSO_CENTER_Y + 0.05;   // pulled up so hem sits at hip
  body.add(poncho);

  // ── Bandolier: TubeGeometry along a CLOSED Catmull-Rom loop wrapping
  // over the left shoulder, diagonally across the chest to the right hip,
  // around the back, and back up to the left shoulder. ABQ R1 fix:
  // pre-R1 the strap was front-only (3 waypoints all +Z) → invisible from
  // behind. Now wraps the torso so the strap reads from any angle.
  const bandolierPoints = [
    // Left shoulder TOP — point of contact over the shoulder ridge
    new THREE.Vector3(-TORSO_CHEST_R * 0.85, TORSO_CENTER_Y + TORSO_H * 0.38, 0.0),
    // Front-mid chest (visible from front; slight forward sag for cloth weight)
    new THREE.Vector3(-0.04, TORSO_CENTER_Y - 0.04, TORSO_CHEST_R * 0.85),
    // Right hip FRONT
    new THREE.Vector3(TORSO_WAIST_R * 0.95, TORSO_CENTER_Y - TORSO_H * 0.32, TORSO_WAIST_R * 0.55),
    // Right hip SIDE — wrap around the right flank
    new THREE.Vector3(TORSO_WAIST_R * 1.05, TORSO_CENTER_Y - TORSO_H * 0.30, -TORSO_WAIST_R * 0.20),
    // Back-mid (visible from behind; diagonal across the back)
    new THREE.Vector3(-0.02, TORSO_CENTER_Y - 0.06, -TORSO_CHEST_R * 0.90),
    // Left shoulder BACK — wrap over the back of the left shoulder back to start
    new THREE.Vector3(-TORSO_CHEST_R * 0.95, TORSO_CENTER_Y + TORSO_H * 0.30, -TORSO_CHEST_R * 0.20),
  ];
  const bandolierCurve = new THREE.CatmullRomCurve3(bandolierPoints, true);   // closed loop
  const bandolier = new THREE.Mesh(
    new THREE.TubeGeometry(bandolierCurve, 36, 0.020, 8, true),               // closed=true
    strapMat,
  );
  body.add(bandolier);
  // Pouches: 4 small boxes along the FRONT strap (t∈[0.0, 0.5] is front
  // half of the loop). Spaced for chest-cluster + one at right hip.
  for (let i = 0; i < 4; i++) {
    const t = 0.05 + i * 0.11;            // front-half spacing
    const pos = bandolierCurve.getPoint(t);
    const tangent = bandolierCurve.getTangent(t);
    const pouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.065, 0.038),
      i % 2 === 0 ? pouchPaintMat : strapMat,
    );
    pouch.position.copy(pos);
    pouch.lookAt(pos.clone().add(tangent));
    body.add(pouch);
  }

  // ── Right shoulder pauldron (ASYMMETRIC — D-entry: scavenger silhouette
  // is signaled by asymmetric salvaged armor). 3 curved boxes layered
  // into a shoulder cap.
  const pauldronAnchor = new THREE.Vector3(SHOULDER_LATERAL, SHOULDER_Y + 0.02, 0);
  for (let i = 0; i < 3; i++) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 - i * 0.02, 0.08, 0.08 + i * 0.012),
      i === 1 ? pauldronPaintMat : pauldronMetalMat,
    );
    plate.position.set(
      pauldronAnchor.x + 0.01 * i,
      pauldronAnchor.y - i * 0.03,
      pauldronAnchor.z,
    );
    plate.rotation.z = -0.3 - i * 0.05;        // tilt outward
    body.add(plate);
  }

  // ── Hips: 2 leg pivots with NEW knee sub-pivots ──
  // ABS P2 R1: replaced uniform cylinders with tapered LatheGeometry
  // profiles for muscle silhouette (thigh swell at hip, calf swell mid-shin).
  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  // Upper leg profile (extends DOWN from hip → knee). Origin at mesh
  // center (-UPPER_LEG_LEN/2 below hip pivot).
  const halfUL = UPPER_LEG_LEN / 2;
  const upperLegProfile = [
    new THREE.Vector2(0, +halfUL),                  // cap top (hip)
    new THREE.Vector2(0.095, +halfUL - 0.01),       // hip thigh top
    new THREE.Vector2(0.105, +halfUL * 0.55),       // thigh widest (quad swell)
    new THREE.Vector2(0.088, 0.0),                  // mid thigh
    new THREE.Vector2(0.068, -halfUL * 0.65),       // lower thigh taper
    new THREE.Vector2(0.058, -halfUL + 0.01),       // knee top
    new THREE.Vector2(0, -halfUL),                  // cap bottom (knee)
  ];
  // Lower leg profile (knee → ankle).
  const halfLL = LOWER_LEG_LEN / 2;
  const lowerLegProfile = [
    new THREE.Vector2(0, +halfLL),                  // cap top (knee)
    new THREE.Vector2(0.058, +halfLL - 0.01),       // knee bottom
    new THREE.Vector2(0.068, +halfLL * 0.45),       // upper calf
    new THREE.Vector2(0.075, +halfLL * 0.10),       // calf widest (calf muscle)
    new THREE.Vector2(0.060, -halfLL * 0.30),       // mid shin
    new THREE.Vector2(0.045, -halfLL * 0.75),       // lower shin
    new THREE.Vector2(0.040, -halfLL + 0.005),      // ankle
    new THREE.Vector2(0, -halfLL),                  // cap bottom (ankle)
  ];
  const upperLegMat = underclothMat.clone();  upperLegMat.side = THREE.DoubleSide;
  const lowerLegMat = underclothMat.clone();  lowerLegMat.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * HIP_LATERAL, HIP_Y, 0);
    body.add(hipPivot);
    // Upper leg — tapered lathe
    const upperLeg = new THREE.Mesh(
      new THREE.LatheGeometry(upperLegProfile, 16),
      upperLegMat,
    );
    upperLeg.position.y = -UPPER_LEG_LEN / 2;
    hipPivot.add(upperLeg);
    // Knee sub-pivot
    const kneeGroup = new THREE.Group();
    kneeGroup.position.y = -UPPER_LEG_LEN;
    hipPivot.add(kneeGroup);
    // Lower leg — tapered lathe
    const lowerLeg = new THREE.Mesh(
      new THREE.LatheGeometry(lowerLegProfile, 16),
      lowerLegMat,
    );
    lowerLeg.position.y = -LOWER_LEG_LEN / 2;
    kneeGroup.add(lowerLeg);
    // Foot: foot box + toe box
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.05, 0.16),
      underclothMat,
    );
    foot.position.set(0, -LOWER_LEG_LEN - 0.025, 0.045);
    kneeGroup.add(foot);
    const toe = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.05),
      underclothMat,
    );
    toe.position.set(0, -LOWER_LEG_LEN - 0.025, 0.155);
    kneeGroup.add(toe);
    hips.push(hipPivot);
    knees.push(kneeGroup);
  }

  // ── Shoulders: 2 arm pivots with NEW elbow sub-pivots ──
  // ABS P2 R1: tapered Lathe profiles for arms (deltoid/bicep swell + tricep,
  // forearm bulk + wrist taper).
  const shoulders: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  let rightHandAttach: THREE.Group | null = null;
  const halfUA = UPPER_ARM_LEN / 2;
  const upperArmProfile = [
    new THREE.Vector2(0, +halfUA),                  // cap top (shoulder)
    new THREE.Vector2(0.070, +halfUA - 0.01),       // deltoid top
    new THREE.Vector2(0.075, +halfUA * 0.35),       // bicep peak
    new THREE.Vector2(0.060, -halfUA * 0.30),       // mid arm taper
    new THREE.Vector2(0.046, -halfUA + 0.01),       // elbow approach
    new THREE.Vector2(0, -halfUA),                  // cap bottom (elbow)
  ];
  const halfLA = LOWER_ARM_LEN / 2;
  const forearmProfile = [
    new THREE.Vector2(0, +halfLA),                  // cap top (elbow)
    new THREE.Vector2(0.046, +halfLA - 0.005),      // elbow bottom
    new THREE.Vector2(0.054, +halfLA * 0.30),       // forearm bulk
    new THREE.Vector2(0.045, -halfLA * 0.35),       // mid forearm
    new THREE.Vector2(0.034, -halfLA + 0.005),      // wrist
    new THREE.Vector2(0, -halfLA),                  // cap bottom (wrist)
  ];
  const upperArmMat = underclothMat.clone();  upperArmMat.side = THREE.DoubleSide;
  const forearmMat = underclothMat.clone();   forearmMat.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * SHOULDER_LATERAL, SHOULDER_Y, 0);
    body.add(shoulderPivot);
    // Upper arm — tapered lathe
    const upperArm = new THREE.Mesh(
      new THREE.LatheGeometry(upperArmProfile, 14),
      upperArmMat,
    );
    upperArm.position.y = -UPPER_ARM_LEN / 2;
    shoulderPivot.add(upperArm);
    // Elbow sub-pivot
    const elbowGroup = new THREE.Group();
    elbowGroup.position.y = -UPPER_ARM_LEN;
    shoulderPivot.add(elbowGroup);
    // Forearm — tapered lathe
    const forearm = new THREE.Mesh(
      new THREE.LatheGeometry(forearmProfile, 14),
      forearmMat,
    );
    forearm.position.y = -LOWER_ARM_LEN / 2;
    elbowGroup.add(forearm);
    // Forearm wraps — 2 fabric tori per arm (stretch but worth shipping
    // since they cover the otherwise-bare underclothMat read).
    for (let w = 0; w < 2; w++) {
      const wrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.012, 4, 12),
        wrapMat,
      );
      wrap.position.y = -0.06 - w * 0.10;
      wrap.rotation.x = Math.PI / 2;
      elbowGroup.add(wrap);
    }
    // Hand: ABS P3 R1 — replaced 6 boxes with palm-lathe + tapered-
    // cylinder fingers + knuckle ridge for "real hand" silhouette at
    // close 3P / FP range.
    const handGroup = new THREE.Group();
    handGroup.position.y = -LOWER_ARM_LEN - 0.04;
    elbowGroup.add(handGroup);
    // Palm — wider + slightly thicker box for proper proportions
    // (real hand is ~85mm wide × 25mm thick × 100mm deep including
    // fingers). Box here is the palm-back only; fingers cylinder-tapered.
    // Hand-local: X = across knuckles (palm width), Z = wrist→knuckle
    // (palm length), Y = palm thickness.
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.028, 0.062), skinMat);
    handGroup.add(palm);
    // Knuckle ridge — narrow box at knuckle line where fingers attach
    const knuckleRidge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.022), skinMat);
    knuckleRidge.position.set(0, 0, -0.028);  // forward edge of palm (knuckle line)
    handGroup.add(knuckleRidge);
    // 4 fingers — tapered cylinders. Each finger extends FORWARD (-Z)
    // from the knuckle line. Slight inward curl via rotation.x.
    // Spacing: -0.027 to +0.027 across hand width (4 fingers @ 0.018 apart)
    for (let f = 0; f < 4; f++) {
      const fingerLen = 0.062 - Math.abs(f - 1.5) * 0.006;  // index+ring slightly shorter, middle longest
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0075, 0.010, fingerLen, 8),
        skinMat,
      );
      // Cylinder default axis = Y; rotate so it points along -Z (forward
      // from knuckle line).
      finger.rotation.x = Math.PI / 2 - 0.35;    // -Z forward + slight curl down
      // Knuckle joint at palm front edge; finger tip extends forward
      finger.position.set(
        -0.027 + f * 0.018,
        -fingerLen * 0.18,                       // slight drop for natural curl
        -0.028 - fingerLen * 0.45,               // forward from knuckle
      );
      handGroup.add(finger);
    }
    // Thumb — tapered cylinder angled outward + forward (opposable)
    const thumb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.011, 0.054, 8),
      skinMat,
    );
    thumb.rotation.z = -0.7;                     // outward angle
    thumb.rotation.x = Math.PI / 2 - 0.5;        // forward tilt
    thumb.position.set(0.038, -0.012, -0.014);
    handGroup.add(thumb);
    // ABP Tier 4 — right-hand attach point for 3P held items
    if (side === 1) {
      rightHandAttach = new THREE.Group();
      rightHandAttach.position.set(0, -0.04, 0.04);   // at palm tip, slightly forward
      handGroup.add(rightHandAttach);
    }
    shoulders.push(shoulderPivot);
    elbows.push(elbowGroup);
  }

  // Fallback — should never happen since side==1 iteration always runs
  if (!rightHandAttach) rightHandAttach = new THREE.Group();

  // Slight forward lean — modern weight-bearing pose vs stick-straight
  body.rotation.x = 0.04;

  return { group: root, body, headGroup, hips, shoulders, knees, elbows, rightHandAttach };
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
    headGroup: visual.headGroup,
    hips: visual.hips,
    shoulders: visual.shoulders,
    knees: visual.knees,
    elbows: visual.elbows,
    rightHandAttach: visual.rightHandAttach,
    state: 'idle',
    heading: 0,
    speedMag: 0,
  };
  return rig;
}

/** Per-frame update: position + heading + state classification + gait.
 *  ABP Tier 2 — 3-phase walk cycle + knee/elbow flex + foot IK + head
 *  counter-bob. */
export function updatePlayerRig(ctx: GameContext, dt: number): void {
  void dt;
  const rig = ctx.player.rig;
  if (!rig) return;

  // Visibility gate — only sync transforms when visible.
  rig.group.visible = ctx.flags.thirdPerson;
  if (!rig.group.visible) return;

  // Position
  const tr = ctx.player.body.body.translation();
  const feetY = tr.y - ctx.player.eyeOffset - 0.5;
  rig.group.position.set(tr.x, feetY, tr.z);

  // Heading — face the camera's horizontal direction.
  const cam = ctx.three.camera;
  const camDir = new THREE.Vector3();
  cam.getWorldDirection(camDir);
  camDir.y = 0;
  if (camDir.lengthSq() > 1e-4) {
    rig.heading = Math.atan2(camDir.x, camDir.z);
  }
  rig.group.rotation.y = rig.heading;

  // Speed magnitude
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
  const isWalking = rig.state === 'walking' || rig.state === 'running';

  if (isWalking) {
    // ABQ R1: amplitudes bumped — pre-R1 read as "subtle" rather than
    // a clear walk; was hipAmp=0.40/0.55, armAmp=hipAmp*0.85. Walk now
    // reads at 3P distance.
    const gaitFreq = rig.state === 'walking' ? 1.6 : 2.4;
    const phase = t * gaitFreq * _PI2;
    const hipAmp = rig.state === 'walking' ? 0.48 : 0.62;
    const armAmp = hipAmp * 0.95;

    // 3-phase walk cycle per leg via 2 sin curves (hip + knee phase-locked
    // so knee bends during MID-SWING — foot in air, leg recovering forward —
    // and STRAIGHTENS at heel-strike + mid-stance + toe-off).
    // Left leg (index 0) phase = phase
    // Right leg (index 1) phase = phase + π
    //
    // ABQ R1 fix: pre-R1 formula `max(0, sin(legPhase - π/3)) * 0.6` peaked
    // knee bend at legPhase=π+π/3 (≈ MID-STANCE, weight-bearing — WRONG).
    // New formula `max(0, cos(legPhase)) * KNEE_AMP` peaks knee at
    // legPhase=0/2π (= mid-swing transition through vertical) — correct.
    for (let i = 0; i < 2; i++) {
      const legPhase = phase + i * Math.PI;
      // Hip rotation: positive on lift (leg forward), negative on extend
      const hipLift = Math.sin(legPhase) * hipAmp;
      rig.hips[i].rotation.x = hipLift;
      // Knee bend: peak at mid-swing (legPhase wraps through 0). Straight
      // at heel-strike (π/2), mid-stance (π), and toe-off (3π/2).
      const kneeBend = Math.max(0, Math.cos(legPhase)) * 0.65;
      rig.knees[i].rotation.x = kneeBend;
    }

    // Arm swing: opposite phase to legs (left arm + right leg together)
    // Plus small forward-back position translation (swing arc, not just rotate)
    for (let i = 0; i < 2; i++) {
      const armPhase = phase + (i === 0 ? Math.PI : 0);   // opposite to same-side leg
      const swing = Math.sin(armPhase) * armAmp;
      rig.shoulders[i].rotation.x = swing;
      // Elbow bend: forearm bends during forward swing
      const elbowBend = Math.max(0, Math.sin(armPhase + Math.PI / 4)) * 0.35;
      rig.elbows[i].rotation.x = elbowBend;
    }

    // Hip sway — body rolls slightly opposite to lifting leg.
    // ABQ R1: bumped 0.012 → 0.020 (was 1.2cm, barely visible).
    rig.body.position.x = Math.sin(phase) * 0.020;

    // Body bob (vertical). ABQ R1: 0.035 → 0.045 walking, 0.060 → 0.075 running.
    const bobAmp = rig.state === 'walking' ? 0.045 : 0.075;
    rig.body.position.y = Math.abs(Math.sin(phase)) * bobAmp;

    // Forward lean during run
    rig.body.rotation.x = rig.state === 'running' ? 0.16 : 0.05;

    // Head counter-bob — head Y inverse of body Y so head stays stable
    rig.headGroup.position.y = HEAD_Y - rig.body.position.y * 0.7;

    // Foot IK to terrain — adjust each hip's effective Y based on terrain
    // height under the foot. Apply after gait so the IK lifts/drops the
    // whole leg root, not just the foot.
    applyFootIK(rig, ctx);

  } else if (rig.state === 'crouching') {
    // Crouch: proper bent knees + lowered body
    for (let i = 0; i < 2; i++) {
      rig.hips[i].rotation.x = 0.50;
      rig.knees[i].rotation.x = 0.85;        // big bend
      rig.shoulders[i].rotation.x = 0.10;
      rig.elbows[i].rotation.x = 0.20;
    }
    rig.body.position.set(0, -0.32, 0);
    rig.body.rotation.x = 0.10;
    rig.headGroup.position.y = HEAD_Y;

  } else {
    // Idle — gentle breathing bob + minimal arm sway
    const bobPhase = t * 0.8 * _PI2;
    rig.body.position.set(0, Math.sin(bobPhase) * 0.012, 0);
    rig.body.rotation.x = 0.04;
    rig.headGroup.position.y = HEAD_Y - rig.body.position.y * 0.6;
    for (let i = 0; i < 2; i++) {
      rig.hips[i].rotation.x = 0;
      rig.knees[i].rotation.x = 0.02;        // tiny knee softness
      rig.shoulders[i].rotation.x = 0.08;
      rig.elbows[i].rotation.x = 0.05;
    }
  }
}

// ── Foot IK helper ────────────────────────────────────────────────────
// Per-frame: for each leg, sample terrain under the foot's intended
// world position. Adjust the hip group's Y to compensate so the foot
// plants on the ground instead of floating/sinking.
//
// Approach: each hip is offset laterally from the rig root by HIP_LATERAL.
// The foot's world XZ = (rig.position.x ± sign·HIP_LATERAL, rig.position.z).
// (rotated by rig.heading — but for the hip lateral offset along the rig's
// LOCAL X axis, we need to rotate the offset by heading first to get the
// world XZ.)
const _footIkScratch = new THREE.Vector3();
function applyFootIK(rig: PlayerRig, ctx: GameContext): void {
  const rootPosX = rig.group.position.x;
  const rootPosZ = rig.group.position.z;
  const rootY = rig.group.position.y;
  const cos = Math.cos(rig.heading);
  const sin = Math.sin(rig.heading);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    // Hip lateral offset in rig-local +X → rotate by heading to world XZ
    const localX = side * HIP_LATERAL;
    const worldX = rootPosX + cos * localX;
    const worldZ = rootPosZ - sin * localX;
    const terrainY = ctx.terrain.heightAt(worldX, worldZ);
    const deltaY = terrainY - rootY;
    // Clamp the IK adjustment to ±15cm — beyond that the leg lifts/drops
    // naturally via the gait cycle (don't over-stretch).
    const clamped = Math.max(-0.15, Math.min(0.15, deltaY));
    rig.hips[i].position.y = HIP_Y + clamped;
    void _footIkScratch;
  }
}
