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
  /** ABV — wrist sub-pivots inside each elbow → before handGroup; rotate
   *  around X for wrist hang/aim. Enables natural hand orientation. */
  wrists: THREE.Group[];
  /** ABV — ankle sub-pivots inside each knee → before foot box; rotate
   *  around X for heel-toe roll (toes up at heel-strike, down at toe-off). */
  ankles: THREE.Group[];
  /** ABV — spine bend pivot inside body → parent of headGroup +
   *  shoulders. Rotates Z for sway during walk, X for sprint lean.
   *  Isolates upper body from leg pivots. */
  spineBend: THREE.Group;
  /** ABP — right-hand world attachment point for 3P held items (Tier 4). */
  rightHandAttach: THREE.Group;
  /** Current animation state. */
  state: RigState;
  /** Heading (yaw) — matches camera yaw in FP, movement direction in 3P. */
  heading: number;
  /** Velocity-derived horizontal speed (m/s). Drives state classification. */
  speedMag: number;
  /** ABY P1 — monotonically-increasing step counter. Incremented once per
   *  heel-strike during walking/running states. Controller compares this
   *  to its previous value and fires the footstep audio + decal each time
   *  the counter advances. Phase-locked to the gait so audio cadence
   *  matches the rig's visible foot motion exactly. */
  stepCount: number;
  /** Internal — last raw phase used to derive stepCount. Reset on state
   *  change to avoid spurious step on walk-resume. */
  _lastStepPhase: number;
}

// ── Proportions (m) — slight tune toward more-human silhouette ──
// ACI PM-A.1: slimmed + more taper (was 0.22 / 0.16 — read as a wide barrel
// with almost no waist). Chest narrower, waist much narrower → real trunk taper.
const TORSO_CHEST_R = 0.185;    // upper torso (shoulders); was 0.22
const TORSO_WAIST_R = 0.115;    // waist — clearly narrower than chest now; was 0.16
const TORSO_H = 0.62;
const HEAD_R = 0.135;            // ACI PM-A.3: bumped 0.12→0.135 — head read small vs the (now-slim) body; better head-height ratio. Scales head + scarf together (relative).
const HEAD_SCALE_Y = 1.12;       // slightly less elongated (was 1.15) — rounder skull
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
// ABX: SKIN_ACCENT retired — face/hand accent colors now inlined
// per material (face = 0x6e4a26 sun-aged, hand = 0x4a3520 grimy).
const PONCHO_COLOR = 0xd9a85a;         // ABP-polish R4: 0xb8860b read as dark brown after fabricMaterial multipliers; bumped to lighter golden ochre for the actual "sun-bleached" silhouette
const HOOD_COLOR = 0xd2b48c;           // desert tan (lighter than poncho) — unified scarf cloth (ACH: bandana folded into this)
const STRAP_COLOR = 0x4a3220;          // ABX: brown leather (was 0x505050 dark metal)
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
  wrists: THREE.Group[];
  ankles: THREE.Group[];
  spineBend: THREE.Group;
  rightHandAttach: THREE.Group;
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // ABV — spine bend pivot. Sits between body and the upper-body
  // children (headGroup, shoulders, torso visuals). Animation tick
  // rotates this for subtle sway during walk + sprint lean. Legs
  // remain children of body (not spineBend) so leg pivots aren't
  // affected by spine sway.
  const spineBend = new THREE.Group();
  body.add(spineBend);

  // ── Materials ──
  // Skin: face + hands. localSpace=true per D109 (moving entity).
  // ABX P2 — face/hand skin tone weathering. Pre-ABX: uniform skinMat
  // (warm tan + matching accent). Now: bumped accent to a richer
  // sun-aged contrast (deeper tan-brown rather than just darker) +
  // reduced sheen so skin reads matte/dry not oily. Pigment blotches
  // (driven by accentColor) become more visible — reads as weathered
  // sun-damaged skin per the scavenger aesthetic.
  const skinMat = createSkinMaterial(SKIN_COLOR, {
    accentColor: 0x6e4a26,       // ABX: deeper sun-aged brown (was 0x8a7048)
    scaleSize: 26.0,
    sheen: 0.22,                 // ABX: matte/dry (was 0.5 — was reading oily)
    localSpace: true,
  });
  // ABX — secondary hands-only skin: same base but with grime accent
  // (dirty knuckles + palms). Per-region material variation.
  const handSkinMat = createSkinMaterial(SKIN_COLOR, {
    accentColor: 0x4a3520,       // grimy darker
    scaleSize: 22.0,             // slightly larger "calluses"
    sheen: 0.18,
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
  const wrapMat = createFabricMaterial(WRAP_COLOR, undefined, { disableShimmer: true });
  // Metal: bandolier strap + pauldron base
  // ABX P4 — bandolier swapped from metalMaterial (was reading too
  // shiny + grey) to fabricMaterial with disableShimmer (matte leather
  // look — brown base, no metal sheen). Reads as worn leather strap.
  const strapMat = createFabricMaterial(STRAP_COLOR, undefined, { disableShimmer: true });
  const pauldronMetalMat = createMetalMaterial(PAULDRON_METAL, { wornScale: 9.0, scratchStrength: 0.10 });
  // Painted-corroded: pouches + pauldron plates (chipped paint over rust)
  const pouchPaintMat = createPaintedMetalMaterial(POUCH_RUST, { wearLevel: 0.6 });
  // ABX P3 — bumped wearLevel 0.7 → 0.88 for more visible rust + paint
  // chipping (more salvaged/battle-scarred read).
  const pauldronPaintMat = createPaintedMetalMaterial(PAULDRON_RUST, { wearLevel: 0.88 });

  // ── Torso: ORGANIC LATHE (ABS R1) ──
  // Pre-ABS: 4-piece composite (2 cylinders + 2 sphere caps) read as
  // "two cans stacked". Replaced with a single LatheGeometry from a
  // profile curve hand-crafted to read as a human torso silhouette:
  //   neck base → shoulder line → chest swell → ribcage taper → waist
  //   narrow → hip flare → crotch.
  // Profile sampled at 9 keypoints in TORSO_LOCAL_Y space (relative to
  // TORSO_CENTER_Y). Radial segments=24 for smooth read.
  // ABS R4: profile refined for more organic contours.
  // ABU P2: smoother neck-cap transition — added 2 intermediate points
  // between cap (0) and neck-base (0.105) to eliminate visible lip.
  const torsoProfile = [
    // [radial, y-offset-from-center]
    new THREE.Vector2(0.0, +0.398),     // CAP top
    new THREE.Vector2(0.025, +0.395),   // ABU: very narrow at cap edge
    new THREE.Vector2(0.055, +0.388),   // ABU: smooth roll into neck
    new THREE.Vector2(0.085, +0.378),   // neck-base smooth (ABU: tighter)
    new THREE.Vector2(0.110, +0.360),   // neck base full width
    new THREE.Vector2(TORSO_CHEST_R * 1.00, +0.345),    // ABU: trapezius rise
    new THREE.Vector2(TORSO_CHEST_R * 1.08, +0.320),    // shoulder line (widest top)
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
  spineBend.add(torsoMesh);   // ABV — upper body bends with spine

  // ── Belt + pouches (ACH Cycle 2.3): cinched leather belt at the waist with
  // utilitarian hip pouches — Rey-scavenger layering depth. Parented to
  // spineBend so it bends with the torso. Front = +Z (matches the face wrap).
  const beltMat = createFabricMaterial(STRAP_COLOR, undefined, { disableShimmer: true });
  const beltY = TORSO_CENTER_Y - 0.185;            // between natural waist + hip
  const beltR = TORSO_WAIST_R * 1.06;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(beltR, 0.024, 6, 22), beltMat);
  belt.position.y = beltY;
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.0, 1.0, 0.88);                  // slight front-back flatten to hug the body
  spineBend.add(belt);
  // Buckle — small box at front center
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.036, 0.022), beltMat);
  buckle.position.set(0, beltY, beltR * 0.92);
  spineBend.add(buckle);
  // Two hip pouches hanging at the front-sides
  for (const side of [-1, 1]) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.090, 0.048), beltMat);
    pouch.position.set(side * 0.105, beltY - 0.055, beltR * 0.62);
    pouch.rotation.y = side * 0.25;                // splay outward to follow the hip curve
    spineBend.add(pouch);
    // pouch flap — thin box over the top edge
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.026, 0.052), beltMat);
    flap.position.set(side * 0.105, beltY - 0.018, beltR * 0.62);
    flap.rotation.y = side * 0.25;
    spineBend.add(flap);
  }

  // ── Backpack (ACH Cycle 2.3): scavenger pack lashed to the back. Front=+Z,
  // so the pack rides -Z. Parented to spineBend so it moves with the torso.
  const packMat = createFabricMaterial(0x6e5d44, undefined, { disableShimmer: true });
  // Mounted OUTSIDE the poncho's back drape (further -Z) so it isn't occluded,
  // and tall enough that the lashed bedroll clears the shoulders above the hood.
  const packZ = -(TORSO_CHEST_R + 0.13);
  const packY = TORSO_CENTER_Y + 0.06;
  const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.14), packMat);
  packBody.position.set(0, packY, packZ);
  spineBend.add(packBody);
  // Top flap (leather)
  const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.07, 0.15), beltMat);
  packFlap.position.set(0, packY + 0.16, packZ + 0.004);
  spineBend.add(packFlap);
  // Bedroll lashed across the top — horizontal cylinder in scarf cloth
  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.26, 10), hoodMat);
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, packY + 0.225, packZ);
  spineBend.add(bedroll);
  // Two shoulder straps crossing from the pack over the shoulders to the chest
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.36, 0.02), beltMat);
    strap.position.set(side * 0.09, packY + 0.06, -0.01);
    strap.rotation.x = -0.32;                  // lean over the shoulder toward the front
    spineBend.add(strap);
  }

  // ── Head: ABT P5 R1 — LatheGeometry profile for organic skull shape.
  // Pre-R1: scaled sphere + flat box jaw = "egg with cartoon mouth board".
  // Now: profile-based lathe (cranium → temple → cheekbone → jaw → chin),
  // 18 radial segments, DoubleSide per D115.
  // Profile in head-local Y (HEAD_R = 0.12 is reference scale).
  const headGroup = new THREE.Group();
  headGroup.position.y = HEAD_Y;
  spineBend.add(headGroup);   // ABV — head bends with spine
  const headProfile = [
    // [radial, axial] — axial 0 = head center
    new THREE.Vector2(0, +HEAD_R * 1.10),          // crown cap top
    new THREE.Vector2(HEAD_R * 0.55, +HEAD_R * 1.05),  // top of cranium
    new THREE.Vector2(HEAD_R * 0.90, +HEAD_R * 0.85),  // upper cranium widening
    new THREE.Vector2(HEAD_R * 1.00, +HEAD_R * 0.55),  // cranium widest (temple region)
    new THREE.Vector2(HEAD_R * 0.98, +HEAD_R * 0.20),  // brow ridge
    new THREE.Vector2(HEAD_R * 0.96, -HEAD_R * 0.05),  // mid-face (cheekbone level)
    new THREE.Vector2(HEAD_R * 0.92, -HEAD_R * 0.30),  // cheek taper
    new THREE.Vector2(HEAD_R * 0.78, -HEAD_R * 0.55),  // jaw line
    new THREE.Vector2(HEAD_R * 0.55, -HEAD_R * 0.85),  // chin point
    new THREE.Vector2(HEAD_R * 0.30, -HEAD_R * 1.00),  // under-chin
    new THREE.Vector2(0, -HEAD_R * 1.05),          // bottom cap
  ];
  const headMat = skinMat.clone();
  headMat.side = THREE.DoubleSide;
  const head = new THREE.Mesh(
    new THREE.LatheGeometry(headProfile, 18),
    headMat,
  );
  headGroup.add(head);
  // Tiny ear bumps (sells "real head" silhouette from 3P)
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), skinMat);
    ear.position.set(sx * (HEAD_R * 0.95), HEAD_R * 0.05, -HEAD_R * 0.10);
    headGroup.add(ear);
  }
  // Neck — real cylinder (was a 4cm stub pre-ABP)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(NECK_R, NECK_R * 1.15, NECK_H, 10),
    skinMat,
  );
  neck.position.y = -HEAD_R * HEAD_SCALE_Y - NECK_H / 2 + 0.02;
  headGroup.add(neck);

  // ── Face wrap (lower edge of the unified scarf) — ACH Cycle 2.2 ──
  // Was a separate dark bandana; now the SAME tan cloth as the hood, thicker,
  // reading as the scarf's lower wrap coming down over the nose/mouth rather
  // than a disconnected band. (Backlog: "unify hood + bandana into a single
  // naturalistic scarf.")
  const bandana = new THREE.Mesh(
    new THREE.TorusGeometry(HEAD_R * 0.88, 0.032, 6, 16),
    hoodMat,
  );
  bandana.position.set(0, -HEAD_R * 0.22, HEAD_R * 0.14);
  bandana.rotation.x = Math.PI / 2;
  bandana.scale.set(1.0, 0.92, 0.62);     // flatten + push back to wrap face
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
  // ACH Cycle 2.2: cloth-fold displacement on the crown (matches the drape's
  // D117 treatment) so it reads as soft wrapped fabric, not a hard helmet
  // dome. phiLength 0.42π → 0.46π drops the crown edge slightly toward the
  // face wrap so the scarf reads continuous.
  // PM-B.1 (ACI): hood that WRAPS the skull — crown + back + sides, with a
  // front wedge open for the face — replacing the flat floating mushroom-disc
  // cap. Hugs the head (radius ~1.1×, centered, no squash) and comes down past
  // the ears (phi → 0.92π). The face opening is the missing theta-wedge,
  // centered on +Z (the face/bandana side).
  const FACE_GAP = Math.PI * 0.58;   // front opening (~104°) for the face
  const hoodCrownGeom = new THREE.SphereGeometry(
    HEAD_R * 1.10, 28, 18,
    Math.PI / 2 + FACE_GAP / 2,        // thetaStart just past the +Z front
    Math.PI * 2 - FACE_GAP,            // wrap all the way around except the face gap
    0, Math.PI * 0.92,                 // crown down past the ears toward the jaw
  );
  {
    const pa = hoodCrownGeom.attributes.position as THREE.BufferAttribute;
    const CROWN_WAVES = 7;
    const CROWN_AMP = 0.013;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const theta = Math.atan2(z, x);
      const off = Math.sin(CROWN_WAVES * theta) * CROWN_AMP;
      pa.setX(i, x + (x / r) * off);
      pa.setZ(i, z + (z / r) * off);
    }
    pa.needsUpdate = true;
    hoodCrownGeom.computeVertexNormals();
  }
  const hoodCrown = new THREE.Mesh(hoodCrownGeom, hoodMat);
  hoodCrown.position.y = HEAD_R * 0.05;   // centered on the skull (was +0.18 floating)
  headGroup.add(hoodCrown);
  // Drape: [225°, 315°] = back-only 90° (was 180° back+sides which covered
  // the cheeks). Front + sides now open so face + bandana read.
  // ABV P2 — hood drape gets D117 cloth-fold treatment matching the
  // poncho's pattern, scaled to head size. Subdivided 14×1 → 18×8 +
  // per-vertex sin-wave radial offsets.
  const hoodDrapeGeom = new THREE.CylinderGeometry(
    HEAD_R * 1.25, HEAD_R * 1.55,
    HEAD_R * 1.80,
    18, 8, true,                          // was 14×1 — now subdivided
    Math.PI * 1.25, Math.PI * 0.50,       // [225°, 315°] = back only
  );
  {
    const posAttr = hoodDrapeGeom.attributes.position as THREE.BufferAttribute;
    const HOOD_FOLD_WAVES = 4;            // fewer waves for smaller mesh
    const HOOD_AMP_HEM = 0.012;           // 1.2cm at hem (scaled for head)
    const HOOD_AMP_TOP = 0.003;           // 0.3cm at top
    const hoodHalfH = HEAD_R * 0.90;      // half of HEAD_R * 1.80
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const theta = Math.atan2(z, x);
      const tt = (y + hoodHalfH) / (hoodHalfH * 2);
      const amp = HOOD_AMP_HEM * (1 - tt) + HOOD_AMP_TOP * tt;
      const foldOffset = Math.sin(HOOD_FOLD_WAVES * theta) * amp;
      const newR = r + foldOffset;
      const scale = newR / r;
      posAttr.setX(i, x * scale);
      posAttr.setZ(i, z * scale);
    }
    posAttr.needsUpdate = true;
    hoodDrapeGeom.computeVertexNormals();
  }
  const hoodDrape = new THREE.Mesh(hoodDrapeGeom, hoodMat);
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
  // ABU P1 — Realistic cloth drape via subdivided geometry + per-vertex
  // sine-wave fold offsets. Pre-ABU: single-segment CylinderGeometry
  // (1 height segment, smooth tube). Now: 10 height segments × 24 radial
  // (576 verts before open-side cut), with per-vertex radial offsets to
  // fake gravity-pulled folds at the hem narrowing toward the shoulders.
  // ABW P2: expanded ponchoR_top 1.08 → 1.32 to clear pectoral swell
  // (torso lathe max radius is 1.18×chest_r=0.260 at upper-chest; previous
  // poncho top 0.238 caused body to poke through the cloth). Hem flare
  // bumped slightly 1.6 → 1.75 to keep the drape proportion natural.
  // ACI PM-A.2 first pass: narrower + longer drape so it reads as cloth hanging
  // off the shoulders, not a wide barrel. (Resting shape only; real folds/sway
  // come in PM-Cycle D cloth physics.) Multipliers bumped a touch since the
  // torso constants shrank, but net width is much smaller than the old ~0.58 dia.
  const ponchoR_top = TORSO_CHEST_R * 1.45;     // clears the (now-slimmer) chest
  const ponchoR_bot = TORSO_WAIST_R * 1.95;     // modest hem flare off the slim waist
  const ponchoH = TORSO_H * 1.05;               // hangs longer (was 0.85) → drapes, not a short tube
  const ponchoGeom = new THREE.CylinderGeometry(
    ponchoR_top, ponchoR_bot, ponchoH,
    24, 10, true,             // 24 radial × 10 height (was 16 × 1)
    Math.PI * 0.15, Math.PI * 1.7,
  );
  // Per-vertex fold offsets: walk position attribute, displace radially.
  // Fold pattern: sin(N × θ) drives ridge/valley around perimeter,
  // attenuated toward the top (folds deepest at hem, gentle at shoulder).
  const posAttr = ponchoGeom.attributes.position as THREE.BufferAttribute;
  // ABU R2: amplitude bumped (R1 hem 2.2cm read as too subtle).
  // ACI PM-A.2 round 2: deeper folds + broken hem so the resting poncho reads
  // as draped cloth, not a smooth grooved tube. (Real motion-drape = PM-Cycle D.)
  const FOLD_WAVES = 8;          // more, deeper vertical fold ridges
  const FOLD_AMP_HEM = 0.075;    // 7.5cm at hem — folds now clearly read
  const FOLD_AMP_TOP = 0.010;    // ~1cm at shoulder
  const halfH = ponchoH / 2;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    // Skip the seam vertices at y=±halfH (top + bottom rings) to avoid
    // discontinuity at the open-side edges.
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const theta = Math.atan2(z, x);
    // t = 0 at hem (y = -halfH), 1 at top (y = +halfH)
    const t = (y + halfH) / ponchoH;
    // Attenuate amplitude: deepest at hem, smallest at top
    const amp = FOLD_AMP_HEM * (1 - t) + FOLD_AMP_TOP * t;
    // Radial displacement — positive = ridge (push out), negative = valley
    const foldOffset = Math.sin(FOLD_WAVES * theta) * amp;
    const newR = r + foldOffset;
    const scale = newR / r;
    posAttr.setX(i, x * scale);
    posAttr.setZ(i, z * scale);
    // PM-A.2: break the hem — fold valleys hang lower toward the bottom edge,
    // so the hem is a scalloped/uneven line instead of a clean horizontal ring.
    const hemDip = Math.max(0, -Math.sin(FOLD_WAVES * theta)) * (1 - t) * (1 - t) * 0.06;
    posAttr.setY(i, y - hemDip);
  }
  posAttr.needsUpdate = true;
  ponchoGeom.computeVertexNormals();
  // ABX P1 — Per-vertex dye stripe pattern. Hand-dyed cloth has
  // visible vertical bands from dipping/wringing unevenness. 5 broad
  // bands around the perimeter, each ±5% darker/lighter. Plus
  // horizontal "wear gradient" (lighter at hem from sun-bleach, darker
  // at shoulders from less exposure). Vertex colors multiply with the
  // fabricMaterial's base color and existing shader layers.
  const colorArr = new Float32Array(posAttr.count * 3);
  const STRIPE_BANDS = 5;             // 5 distinct vertical bands
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const r = Math.hypot(x, z);
    const theta = r < 1e-4 ? 0 : Math.atan2(z, x);
    // 5-band stripe in [0, 1] — alternating slight tint shifts
    // Normalize theta to [0, 2π], then bucket into bands
    const thetaNorm = (theta + Math.PI * 2) % (Math.PI * 2);
    const bandIdx = Math.floor((thetaNorm / (Math.PI * 2)) * STRIPE_BANDS);
    // Band tints: cycle through subtle warm/cool variations
    // Even bands slightly darker + warmer; odd bands slightly lighter + cooler
    const bandTint = bandIdx % 2 === 0
      ? { r: 0.93, g: 0.91, b: 0.86 }   // warm-darker (more saturated dye)
      : { r: 1.05, g: 1.02, b: 0.97 };  // cool-lighter (sun-bleached)
    // Vertical wear gradient — hem (t=0) is more sun-bleached, top (t=1)
    // is more shaded. Slight ±3% brightness lerp.
    const t = (y + halfH) / ponchoH;
    const wearMul = 1.0 + (1 - t) * 0.05 - t * 0.03;  // hem brighter, top dimmer
    colorArr[i * 3 + 0] = bandTint.r * wearMul;
    colorArr[i * 3 + 1] = bandTint.g * wearMul;
    colorArr[i * 3 + 2] = bandTint.b * wearMul;
  }
  ponchoGeom.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  // Clone ponchoMat to enable vertexColors without affecting other
  // fabric instances (e.g., bandana, hood, forearm wraps share ponchoMat-
  // adjacent materials).
  const ponchoMatStriped = ponchoMat.clone();
  ponchoMatStriped.vertexColors = true;
  const poncho = new THREE.Mesh(ponchoGeom, ponchoMatStriped);
  poncho.position.y = TORSO_CENTER_Y + 0.05;
  spineBend.add(poncho);   // ABV — poncho bends with spine

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
  spineBend.add(bandolier);   // ABV — bandolier bends with spine
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
    spineBend.add(pouch);   // ABV — pouches bend with spine
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
    spineBend.add(plate);   // ABV — pauldron bends with spine
    // ABX P3 — 4 rivets per plate (corners). Small dark metal spheres
    // sell the "salvaged scrap-bolted-together armor" aesthetic.
    const plateW = 0.16 - i * 0.02;
    const plateD = 0.08 + i * 0.012;
    const rivetSize = 0.006;
    for (const rx of [-plateW * 0.40, plateW * 0.40]) {
      for (const rz of [-plateD * 0.40, plateD * 0.40]) {
        const rivet = new THREE.Mesh(
          new THREE.SphereGeometry(rivetSize, 6, 4),
          pauldronMetalMat,
        );
        // Position rivets on the OUTWARD face of the plate (camera-facing
        // side), accounting for the plate's z-tilt rotation.
        const cosZ = Math.cos(-0.3 - i * 0.05);
        const sinZ = Math.sin(-0.3 - i * 0.05);
        rivet.position.set(
          pauldronAnchor.x + 0.01 * i + cosZ * rx - sinZ * 0.041,
          pauldronAnchor.y - i * 0.03 + sinZ * rx + cosZ * 0.041,
          pauldronAnchor.z + rz,
        );
        spineBend.add(rivet);
      }
    }
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
  // ABY P2: calf muscle peak bumped 0.075 → 0.082 for more pronounced
  // muscle bulge; added intermediate point at +halfLL*0.25 for smoother
  // curve through the calf swell.
  const halfLL = LOWER_LEG_LEN / 2;
  const lowerLegProfile = [
    new THREE.Vector2(0, +halfLL),                  // cap top (knee)
    new THREE.Vector2(0.058, +halfLL - 0.01),       // knee bottom
    new THREE.Vector2(0.068, +halfLL * 0.45),       // upper calf
    new THREE.Vector2(0.078, +halfLL * 0.25),       // ABY: intermediate for smoother bulge
    new THREE.Vector2(0.082, +halfLL * 0.10),       // ABY: calf widest (was 0.075)
    new THREE.Vector2(0.072, -halfLL * 0.10),       // ABY: intermediate post-peak
    new THREE.Vector2(0.060, -halfLL * 0.30),       // mid shin
    new THREE.Vector2(0.045, -halfLL * 0.75),       // lower shin
    new THREE.Vector2(0.040, -halfLL + 0.005),      // ankle
    new THREE.Vector2(0, -halfLL),                  // cap bottom (ankle)
  ];
  const upperLegMat = underclothMat.clone();  upperLegMat.side = THREE.DoubleSide;
  const lowerLegMat = underclothMat.clone();  lowerLegMat.side = THREE.DoubleSide;
  const ankles: THREE.Group[] = [];   // ABV
  for (const side of [-1, 1]) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * HIP_LATERAL, HIP_Y, 0);
    body.add(hipPivot);     // legs stay on body, NOT spineBend
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
    // ACH Cycle 2.3: boot wraps — cloth bands around the lower shin/ankle
    // (Rey cloth-wrapped boots), same hand-wrapped vocabulary as the forearm
    // wraps. Added to kneeGroup so they ride the lower leg.
    const BOOT_BANDS = 5;
    for (let b = 0; b < BOOT_BANDS; b++) {
      const t = b / (BOOT_BANDS - 1);
      const bandR = 0.060 - t * 0.018;                 // taper toward the ankle
      const bw = new THREE.Mesh(new THREE.TorusGeometry(bandR, 0.011, 6, 14), wrapMat);
      bw.position.y = -LOWER_LEG_LEN * (0.46 + t * 0.46);  // lower-shin span
      bw.rotation.x = Math.PI / 2;
      bw.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.05;   // hand-wrapped unevenness
      kneeGroup.add(bw);
    }
    // ABV — ankle sub-pivot at end of lower leg. Foot + toe attach
    // here so ankle rotation around X drives heel-toe roll.
    const ankleGroup = new THREE.Group();
    ankleGroup.position.y = -LOWER_LEG_LEN;
    kneeGroup.add(ankleGroup);
    // Foot: foot box + toe box (now children of ankle)
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.05, 0.16),
      underclothMat,
    );
    foot.position.set(0, -0.025, 0.045);
    ankleGroup.add(foot);
    const toe = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.05),
      underclothMat,
    );
    toe.position.set(0, -0.025, 0.155);
    ankleGroup.add(toe);
    hips.push(hipPivot);
    knees.push(kneeGroup);
    ankles.push(ankleGroup);
  }

  // ── Shoulders: 2 arm pivots with NEW elbow sub-pivots ──
  // ABS P2 R1: tapered Lathe profiles for arms (deltoid/bicep swell + tricep,
  // forearm bulk + wrist taper).
  const shoulders: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  let rightHandAttach: THREE.Group | null = null;
  const halfUA = UPPER_ARM_LEN / 2;
  // ABY P2: bicep peak bumped 0.075 → 0.082 + intermediate point at
  // halfUA * 0.20 for smoother bulge through bicep mass.
  const upperArmProfile = [
    new THREE.Vector2(0, +halfUA),                  // cap top (shoulder)
    new THREE.Vector2(0.072, +halfUA - 0.01),       // ABY: deltoid top (was 0.070)
    new THREE.Vector2(0.080, +halfUA * 0.45),       // ABY: intermediate upper-bicep
    new THREE.Vector2(0.082, +halfUA * 0.20),       // ABY: bicep peak (was 0.075 at 0.35)
    new THREE.Vector2(0.072, -halfUA * 0.05),       // ABY: post-peak fall
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
  const wrists: THREE.Group[] = [];   // ABV
  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * SHOULDER_LATERAL, SHOULDER_Y, 0);
    spineBend.add(shoulderPivot);   // ABV — arms bend with spine
    // Upper arm — tapered lathe
    const upperArm = new THREE.Mesh(
      new THREE.LatheGeometry(upperArmProfile, 14),
      upperArmMat,
    );
    upperArm.position.y = -UPPER_ARM_LEN / 2;
    shoulderPivot.add(upperArm);
    // ABU P2 — deltoid bridge: small sphere at the very top of the
    // shoulder that hides the cap-to-torso gap and adds a natural
    // "shoulder cap" look. Slightly larger than the arm top radius so
    // it bulges outward.
    const deltoid = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 14, 8),
      underclothMat,
    );
    deltoid.position.set(0, 0.005, 0);   // at shoulder pivot, slight up
    deltoid.scale.set(1.0, 0.75, 1.0);    // squashed for shoulder shape
    shoulderPivot.add(deltoid);
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
    // Forearm wraps — ACH Cycle 2.1: Rey-tier tight band stack. Replaces the
    // 2 sparse tori (read as smooth cloth) with a column of ~6 bands covering
    // the forearm, tapering toward the wrist (follows the forearm lathe
    // profile) with a small gap between each + slight alternating tilt so
    // they read as hand-wrapped strips, not machined rings.
    const WRAP_BANDS = 7;
    for (let w = 0; w < WRAP_BANDS; w++) {
      const t = w / (WRAP_BANDS - 1);              // 0 near elbow → 1 mid-forearm
      const bandR = 0.052 - t * 0.012;             // taper 0.052 → 0.040
      const bandTube = 0.0105 + (w % 2) * 0.0025;  // alternate thick/thin → uneven hand-wrap
      const wrap = new THREE.Mesh(
        new THREE.TorusGeometry(bandR, bandTube, 6, 14),
        wrapMat,
      );
      // Tight stack over the mid-forearm only (stay OFF the wrist so bands
      // don't droop past the hand). Step 0.019 vs tube-dia 0.022 → bands
      // nearly touch, reading as continuous bound cloth with shallow grooves.
      wrap.position.y = -0.05 - w * 0.019;         // span -0.05 → -0.164
      wrap.rotation.x = Math.PI / 2;
      wrap.rotation.z = (w % 2 === 0 ? 1 : -1) * 0.05;  // hand-wrapped unevenness
      elbowGroup.add(wrap);
    }
    // ABV — wrist sub-pivot inserted between elbow and hand. Rotation X
    // = palm-up/down hang; rotation Z = wrist-roll for grip orientation.
    const wristGroup = new THREE.Group();
    wristGroup.position.y = -LOWER_ARM_LEN - 0.02;
    elbowGroup.add(wristGroup);
    wrists.push(wristGroup);
    // Hand: ABS P3 R1 — replaced 6 boxes with palm-lathe + tapered-
    // cylinder fingers + knuckle ridge for "real hand" silhouette at
    // close 3P / FP range.
    const handGroup = new THREE.Group();
    handGroup.position.y = -0.02;   // small hand-attach offset from wrist
    wristGroup.add(handGroup);
    // Palm — wider + slightly thicker box for proper proportions
    // (real hand is ~85mm wide × 25mm thick × 100mm deep including
    // fingers). Box here is the palm-back only; fingers cylinder-tapered.
    // Hand-local: X = across knuckles (palm width), Z = wrist→knuckle
    // (palm length), Y = palm thickness.
    // ACH Cycle 2.1: fingerless glove — palm + knuckle ridge in the wrap
    // cloth (same scavenger material as the forearm wraps), fingers left bare
    // skin → exposed fingertips, the "cutout at the knuckles" read.
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.028, 0.062), wrapMat);
    handGroup.add(palm);
    // Knuckle ridge — narrow box at knuckle line where fingers attach (glove edge)
    const knuckleRidge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.022), wrapMat);
    knuckleRidge.position.set(0, 0, -0.028);  // forward edge of palm (knuckle line)
    handGroup.add(knuckleRidge);
    // 4 fingers — tapered cylinders. Each finger extends FORWARD (-Z)
    // from the knuckle line. Slight inward curl via rotation.x.
    // Spacing: -0.027 to +0.027 across hand width (4 fingers @ 0.018 apart)
    for (let f = 0; f < 4; f++) {
      const fingerLen = 0.062 - Math.abs(f - 1.5) * 0.006;  // index+ring slightly shorter, middle longest
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0075, 0.010, fingerLen, 8),
        handSkinMat,
      );
      // Cylinder default axis = Y; rotate so it points along -Z (forward
      // from knuckle line).
      finger.rotation.x = Math.PI / 2 - 0.35;    // -Z forward + slight curl down
      // Knuckle joint at palm front edge; finger tip extends forward
      const fingerX = -0.027 + f * 0.018;
      const fingerY = -fingerLen * 0.18;
      const fingerZ = -0.028 - fingerLen * 0.45;
      finger.position.set(fingerX, fingerY, fingerZ);
      handGroup.add(finger);
      // ABU P2 / ACH Cycle 2.1 fix — knuckle bumps: 2 small spheres at ~1/3
      // + 2/3 along each finger for visible joint inflections. PARENTED to the
      // finger so they ride its local Y axis exactly. (The prior code placed
      // them in world space via a wrong-sign forward vector + offsets ~3× the
      // finger length — which left them floating off the fingertips, the bug
      // surfaced in the ACH rig close-ups.)
      for (const frac of [1 / 3, 2 / 3]) {
        const knuckle = new THREE.Mesh(
          new THREE.SphereGeometry(0.0115, 6, 5),
          handSkinMat,
        );
        knuckle.position.y = (frac - 0.5) * fingerLen;  // along the finger's own axis
        finger.add(knuckle);
      }
    }
    // Thumb — tapered cylinder angled outward + forward (opposable)
    const thumb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.011, 0.054, 8),
      handSkinMat,
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
  // ABV: moved from body.rotation.x to spineBend.rotation.x so legs
  // aren't tilted with the lean.
  spineBend.rotation.x = 0.04;

  return { group: root, body, headGroup, hips, shoulders, knees, elbows, wrists, ankles, spineBend, rightHandAttach };
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
    wrists: visual.wrists,
    ankles: visual.ankles,
    spineBend: visual.spineBend,
    rightHandAttach: visual.rightHandAttach,
    state: 'idle',
    heading: 0,
    speedMag: 0,
    stepCount: 0,
    _lastStepPhase: 0,
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

  // Position — ABT P2 fix: pre-fix used `tr.y - eyeOffset - 0.5` which
  // is an approximate magic number that doesn't match actual capsule
  // halfHeight + radius. Feet were ending up under terrain. Now we
  // query terrain.heightAt(x, z) directly and plant rig.group.position.y
  // at terrainY (feet sit ON sand, not under it). The foot IK helper
  // still does per-foot variation on top of this.
  const tr = ctx.player.body.body.translation();
  const groundY = ctx.terrain.heightAt(tr.x, tr.z);
  rig.group.position.set(tr.x, groundY, tr.z);

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

    // ABY P1 — step counter increment. Heel-strikes happen at
    // legPhase = π/2, 3π/2, 5π/2, ... (sin peaks of opposite-leg pair),
    // so the GLOBAL phase passes a step-boundary every π radians offset
    // from π/2. Track _lastStepPhase; count how many π-spaced
    // boundaries (offset π/2) we've crossed since last frame.
    {
      const stepBoundary = Math.PI / 2;   // first heel-strike phase
      const stepPeriod = Math.PI;          // one heel-strike every π
      const prevSteps = Math.floor((rig._lastStepPhase - stepBoundary) / stepPeriod);
      const curSteps = Math.floor((phase - stepBoundary) / stepPeriod);
      const delta = curSteps - prevSteps;
      if (delta > 0 && rig._lastStepPhase > 0) {
        // First frame after state-change has _lastStepPhase ≈ 0 from idle
        // reset — skip that frame's massive delta to avoid burst.
        if (delta < 5) rig.stepCount += delta;
      }
      rig._lastStepPhase = phase;
    }

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
      // ABV — ankle heel-toe roll. cos(legPhase) is +1 at heel-strike
      // (toes UP for dorsiflexion), -1 at toe-off (toes DOWN for
      // plantarflexion push-off). Scale: +0.30 / -0.45 rad.
      const cosPhase = Math.cos(legPhase);
      rig.ankles[i].rotation.x = cosPhase > 0
        ? cosPhase * 0.30      // heel-strike side: toes up
        : cosPhase * 0.45;     // toe-off side: toes more aggressively down
    }

    // Arm swing: opposite phase to legs (left arm + right leg together)
    for (let i = 0; i < 2; i++) {
      const armPhase = phase + (i === 0 ? Math.PI : 0);   // opposite to same-side leg
      const swing = Math.sin(armPhase) * armAmp;
      rig.shoulders[i].rotation.x = swing;
      // Elbow bend: forearm bends during forward swing
      const elbowBend = Math.max(0, Math.sin(armPhase + Math.PI / 4)) * 0.35;
      rig.elbows[i].rotation.x = elbowBend;
      // ABV — wrist subtle hang + slight inward roll during forward swing
      rig.wrists[i].rotation.x = -0.10 + swing * 0.15;   // base hang + lerp w/ swing
    }

    // Hip sway — body rolls slightly opposite to lifting leg.
    rig.body.position.x = Math.sin(phase) * 0.020;

    // Body bob (vertical). ABQ R1: 0.035 → 0.045 walking, 0.060 → 0.075 running.
    const bobAmp = rig.state === 'walking' ? 0.045 : 0.075;
    rig.body.position.y = Math.abs(Math.sin(phase)) * bobAmp;

    // ABV — spine bend: subtle Z-axis sway (lateral) opposite to hip
    // lift + X-axis forward lean during sprint (replaces ABQ
    // body.rotation.x which tilted whole body including legs).
    rig.spineBend.rotation.z = -Math.sin(phase) * 0.05;   // opposite roll
    rig.spineBend.rotation.x = rig.state === 'running' ? 0.16 : 0.05;
    // Keep body.rotation.x at 0 — lean now lives in spineBend only.
    rig.body.rotation.x = 0;

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
      rig.wrists[i].rotation.x = -0.10;      // ABV — relaxed hang
      rig.ankles[i].rotation.x = 0;          // ABV — feet flat in crouch
    }
    rig.body.position.set(0, -0.32, 0);
    rig.body.rotation.x = 0;
    rig.spineBend.rotation.x = 0.10;         // ABV — crouch lean lives in spine
    rig.spineBend.rotation.z = 0;
    rig.headGroup.position.y = HEAD_Y;

  } else {
    // Idle — gentle breathing bob + minimal arm sway
    const bobPhase = t * 0.8 * _PI2;
    rig.body.position.set(0, Math.sin(bobPhase) * 0.012, 0);
    rig.body.rotation.x = 0;
    rig.spineBend.rotation.x = 0.04;         // ABV — idle lean lives in spine
    rig.spineBend.rotation.z = 0;
    rig.headGroup.position.y = HEAD_Y - rig.body.position.y * 0.6;
    for (let i = 0; i < 2; i++) {
      rig.hips[i].rotation.x = 0;
      rig.knees[i].rotation.x = 0.02;        // tiny knee softness
      rig.shoulders[i].rotation.x = 0.08;
      rig.elbows[i].rotation.x = 0.05;
      rig.wrists[i].rotation.x = -0.15;      // ABV — relaxed hang in idle
      rig.ankles[i].rotation.x = 0;          // ABV — feet flat in idle
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
