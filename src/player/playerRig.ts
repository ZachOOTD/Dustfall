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
import { buildSkinnedLimb } from './skinnedLimb.ts';
import { getItemDef } from '../inventory/items.ts';

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
  hips: THREE.Object3D[];   // ACJ: skeleton Bones (skinned legs)
  shoulders: THREE.Object3D[];   // ACJ: skeleton Bones (skinned arms)
  /** ABP — knee sub-pivots inside each hip; rotate around X for knee flex
   *  during 3-phase walk cycle. */
  knees: THREE.Object3D[];   // ACJ: skeleton Bones (skinned legs)
  /** ABP — elbow sub-pivots inside each shoulder; rotate around X for
   *  elbow bend during arm swing + aim-IK (Tier 5). */
  elbows: THREE.Object3D[];   // ACJ: skeleton Bones (skinned arms)
  /** ABV — wrist sub-pivots inside each elbow → before handGroup; rotate
   *  around X for wrist hang/aim. Enables natural hand orientation. */
  wrists: THREE.Object3D[];   // ACJ: skeleton Bones (skinned arms)
  /** ABV — ankle sub-pivots inside each knee → before foot box; rotate
   *  around X for heel-toe roll (toes up at heel-strike, down at toe-off). */
  ankles: THREE.Object3D[];   // ACJ: skeleton Bones (skinned legs)
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
  /** ACL AIM TWIST-IK — smoothed aim-twist yaw (rad) applied additively to
   *  the right shoulder so the upper body leads toward the camera's facing
   *  direction. Lerped each frame toward the clamped target. */
  _aimTwist: number;
  /** ACN — previous frame's `heading`, for deriving the camera turn RATE that
   *  drives the dynamic aim-lead (the shoulder winds into the turn). */
  _aimPrevHeading: number;
}

// ── Proportions (m) — slight tune toward more-human silhouette ──
// ACI PM-A.1: slimmed + more taper (was 0.22 / 0.16 — read as a wide barrel
// with almost no waist). Chest narrower, waist much narrower → real trunk taper.
const TORSO_CHEST_R = 0.185;    // upper torso (shoulders); was 0.22
const TORSO_WAIST_R = 0.115;    // waist — clearly narrower than chest now; was 0.16
const TORSO_H = 0.62;
const HEAD_R = 0.115;            // ACK realism R1: 0.135→0.115. The ACI 0.135 read at ~1:6.7 head-to-height (cartoony big head). 0.115 → head ~0.23m on a ~1.85m figure ≈ 1:7.7, a realistic adult ratio. Scales head + hood + goggles + scarf together.
const HEAD_SCALE_Y = 1.18;       // ACK: slightly taller skull (real heads are ~1.25× tall-vs-wide); was 1.12
const NECK_R = 0.050;            // ACK: slimmer neck
const NECK_H = 0.135;            // ACK realism R1: 0.10→0.135 — a longer neck reads human; the stub neck read non-human
const LEG_LEN = 0.85;
const UPPER_LEG_LEN = 0.45;
const LOWER_LEG_LEN = LEG_LEN - UPPER_LEG_LEN;
const ARM_LEN = 0.65;
const UPPER_ARM_LEN = 0.32;   // elbow joint depth; forearm = ARM_LEN - UPPER_ARM_LEN (skinned tube spans both)
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
// ACU — Rey-like off-white outfit. Was desert-tan/olive/grey (read dark). The
// dominant cloth (hood/scarf wrap, forearm wraps, main tunic) goes to pale
// sun-bleached cream; the leather belt/pouches/pack stay dark as accent contrast.
const HOOD_COLOR = 0xeee7d8;           // ACU: off-white linen (was 0xd2b48c desert tan) — base pushed light so the fabric shader's tan mid-tone + stains still read off-white
const STRAP_COLOR = 0x4a3220;          // ABX: brown leather (was 0x505050 dark metal)
const POUCH_RUST = 0xa0522d;           // rust-orange
const PAULDRON_METAL = 0x6a6a6a;       // dark grey metal
const PAULDRON_RUST = 0x8a4a28;        // chipped paint reveals rust
const WRAP_COLOR = 0xe0d6c0;           // ACU: light linen (was 0x7a7a7a warm grey)

function buildRigVisual(): {
  group: THREE.Group;
  body: THREE.Group;
  headGroup: THREE.Group;
  hips: THREE.Object3D[];   // ACJ: skeleton Bones (skinned legs)
  shoulders: THREE.Object3D[];   // ACJ: skeleton Bones (skinned arms)
  knees: THREE.Object3D[];   // ACJ: skeleton Bones (skinned legs)
  elbows: THREE.Object3D[];   // ACJ: skeleton Bones (skinned arms)
  wrists: THREE.Object3D[];   // ACJ: skeleton Bones (skinned arms)
  ankles: THREE.Object3D[];   // ACJ: skeleton Bones (skinned legs)
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
    accentColor: 0x7a4636,       // ACK PM-E: redder/warmer sun-aged tone (subsurface warmth) — was 0x6e4a26
    scaleSize: 30.0,             // ACK: finer pores
    sheen: 0.14,                 // ACK: matte dry skin
    localSpace: true,
    // ACU — PM-E PBR lighting REVERTED. The derivative-based (`dFdx/dFdy`)
    // micro-bump perturbed the view-space normal from screen-space derivatives;
    // on the moving/animating rig that shimmered/sparkled as the model moved
    // (the user's "glitchy when it moves"). Dropping `pbr` falls back to Lambert
    // (vertex-lit, smooth normal — no derivative term) and skips the baked-
    // occlusion block too. The procedural skin COLOR (pigment/cells/veins/sheen/
    // grain) is unaffected (not pbr-gated), so the look survives minus the relief.
  });
  // ABX — secondary hands-only skin: same base but with grime accent
  // (dirty knuckles + palms). Per-region material variation.
  const handSkinMat = createSkinMaterial(SKIN_COLOR, {
    accentColor: 0x4a3520,       // grimy darker
    scaleSize: 24.0,             // slightly larger "calluses"
    sheen: 0.12,
    localSpace: true,
    // ACU — PBR reverted (see skinMat above): derivative micro-bump shimmered on the moving rig.
  });
  // Torso/limbs under poncho — same skin tone but slightly darker
  // (shadows under cloth). Player can't see most of this; the cloth
  // covers it. Keeps the rig recognisable in any cloth-strip edge case.
  const underclothMat = createSkinMaterial(0x6a5a3a, {
    accentColor: 0x4a3a26,
    scaleSize: 22.0,
    sheen: 0.18,                 // ACK PM-E: matte
    localSpace: true,
    // ACU — PBR reverted (see skinMat above): derivative micro-bump shimmered on the moving rig.
  });
  // Cloth layers — fabric shader with disableShimmer (rig is a moving
  // entity; shimmer would crawl per ABN/D109 sibling pattern).
  // ACU — PM-E PBR reverted on all rig cloth (same shimmer fix as the skin): the
  // pbr path's derivative-based normal bump sparkled as the player moved. Back to
  // Lambert; the fabric weave/stain/grain COLOR is unaffected (not pbr-gated).
  const hoodMat = createFabricMaterial(HOOD_COLOR, undefined, { disableShimmer: true });
  // PM-B.3 (ACJ): pale sun-bleached face-wrap cloth — deliberately lighter +
  // cooler than the warm skin tone so the lower-face scarf reads as a distinct
  // cloth layer (the old same-tone bandana blended into the skin = invisible).
  const scarfMat = createFabricMaterial(0xe4dcc4, undefined, { disableShimmer: true });
  const wrapMat = createFabricMaterial(WRAP_COLOR, undefined, { disableShimmer: true });
  // ACU — limbs CLOTHED (were bare dark skin via underclothMat). The figure now
  // reads dressed head-to-toe in the off-white outfit: sleeves over the arms +
  // shoulders, leggings over the legs/hips, a cloth collar at the neck. Sleeves
  // match the forearm-wrap linen; leggings are a slightly darker warm-grey so the
  // trousers read distinct from the off-white tunic; collar matches the scarf.
  const sleeveMat = createFabricMaterial(0xe0d6c0, undefined, { disableShimmer: true }); // light linen sleeves
  const trouserMat = createFabricMaterial(0xbcb097, undefined, { disableShimmer: true }); // warm grey-tan leggings
  const collarMat = createFabricMaterial(0xe4dcc4, undefined, { disableShimmer: true });  // neck wrap/collar (matches scarf)
  // Metal: bandolier strap + pauldron base
  // ABX P4 — bandolier swapped from metalMaterial (was reading too
  // shiny + grey) to fabricMaterial with disableShimmer (matte leather
  // look — brown base, no metal sheen). Reads as worn leather strap.
  const strapMat = createFabricMaterial(STRAP_COLOR, undefined, { disableShimmer: true });
  // ACT — localSpace: true (D109) on ALL the rig's procedural metal/paint.
  // The player rig MOVES (and is the most-viewed moving model in 3P), so
  // world-space noise sampling made scratches + paint-chips crawl across the
  // pauldron / pouches / goggle rim as the player walked — same swim class as
  // the speeder antenna. localSpace anchors the weathering to the body frame.
  const pauldronMetalMat = createMetalMaterial(PAULDRON_METAL, { wornScale: 9.0, scratchStrength: 0.10, localSpace: true });
  // Painted-corroded: pouches + pauldron plates (chipped paint over rust)
  const pouchPaintMat = createPaintedMetalMaterial(POUCH_RUST, { wearLevel: 0.6, localSpace: true });
  // ABX P3 — bumped wearLevel 0.7 → 0.88 for more visible rust + paint
  // chipping (more salvaged/battle-scarred read).
  const pauldronPaintMat = createPaintedMetalMaterial(PAULDRON_RUST, { wearLevel: 0.88, localSpace: true });

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
    new THREE.Vector2(TORSO_WAIST_R * 1.25, -0.220),    // upper hip (ACJ: wider to meet thighs)
    new THREE.Vector2(TORSO_WAIST_R * 1.62, -0.280),    // hip line (ACJ widened 1.35→1.62 so the pelvis covers the thigh tops)
    new THREE.Vector2(TORSO_WAIST_R * 1.48, -0.330),    // upper thigh attach (ACJ 1.20→1.48)
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

  // ── Torso tunic (PM-C, ACK) ──
  // Re-dresses the torso after the poncho cut (D139). Unlike the poncho (a flared
  // cylinder that read as stiff boxy panels), this HUGS the body — a lathe that
  // follows the torso profile offset outward by a cloth thickness, from a
  // neckline at the trapezius down to a hem at the upper hip. Sleeveless (top
  // radius ≈ the arm-attach lateral, so the skinned arms emerge just outside +
  // the deltoid caps the gap). Distinct cloth tone from skin/undercloth so it
  // reads as a worn garment. Resting shape only — real drape/sway is PM-D cloth.
  const garmentMat = createFabricMaterial(0xece4d3, undefined, { disableShimmer: true }); // ACU — Rey off-white wrapped tunic (was 0x83805d olive-drab); PBR reverted (shimmer fix)
  garmentMat.side = THREE.DoubleSide;
  const GOFF = 0.017;   // cloth thickness over the body
  const tunicProfile = [
    new THREE.Vector2(TORSO_CHEST_R * 1.00 + 0.008, +0.332),   // neckline (open top, just below trapezius)
    new THREE.Vector2(TORSO_CHEST_R * 1.08 + GOFF,  +0.315),   // shoulder line
    new THREE.Vector2(TORSO_CHEST_R * 1.18 + GOFF,  +0.230),   // upper chest
    new THREE.Vector2(TORSO_CHEST_R * 1.15 + GOFF,  +0.140),   // pec curve
    new THREE.Vector2(TORSO_CHEST_R * 1.04 + GOFF,  +0.040),   // sternum
    new THREE.Vector2(TORSO_CHEST_R * 0.88 + GOFF,  -0.060),   // lower ribcage
    new THREE.Vector2(TORSO_WAIST_R * 0.98 + 0.020, -0.150),   // waist (under the belt)
    new THREE.Vector2(TORSO_WAIST_R * 1.25 + 0.022, -0.210),   // hem at upper hip (open bottom)
  ];
  const tunicGeom = new THREE.LatheGeometry(tunicProfile, 28);
  // Subtle cloth folds + broken hem so it reads as worn fabric, not a smooth
  // shell. Fitted garment → gentle amplitude (vs the old poncho's 7.5cm). Folds
  // deepest at the hem, fade to nothing at the neckline; valleys dip the hem
  // edge so it's an uneven line. (Real motion-drape is PM-D.)
  {
    const pa = tunicGeom.attributes.position as THREE.BufferAttribute;
    const TUNIC_TOP_Y = 0.332, TUNIC_BOT_Y = -0.210;
    const span = TUNIC_TOP_Y - TUNIC_BOT_Y;
    const WAVES = 7;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const theta = Math.atan2(z, x);
      const t = (y - TUNIC_BOT_Y) / span;           // 0 at hem → 1 at neckline
      const amp = 0.020 * (1 - t) + 0.004 * t;      // 2cm hem → 0.4cm neck
      const fold = Math.sin(WAVES * theta) * amp;
      const scale = (r + fold) / r;
      pa.setX(i, x * scale);
      pa.setZ(i, z * scale);
      // Break the hem: fold valleys hang lower near the bottom edge.
      const hemDip = Math.max(0, -Math.sin(WAVES * theta)) * (1 - t) * (1 - t) * 0.028;
      pa.setY(i, y - hemDip);
    }
    pa.needsUpdate = true;
    tunicGeom.computeVertexNormals();
  }
  const tunic = new THREE.Mesh(tunicGeom, garmentMat);
  tunic.position.y = TORSO_CENTER_Y;
  spineBend.add(tunic);
  // Asymmetric wrap seam — a thin diagonal cloth band across the chest (a
  // wrapped-tunic overlap edge), front-left to right hip. Sells "wrapped cloth"
  // + breaks the uniform shell. Front = +Z.
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.40, 0.02),
    garmentMat,
  );
  seam.position.set(-TORSO_CHEST_R * 0.35, TORSO_CENTER_Y + 0.06, TORSO_CHEST_R * 1.05);
  seam.rotation.z = 0.5;            // diagonal across the chest
  seam.rotation.x = -0.12;          // hug the chest curve
  spineBend.add(seam);

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
  const packMat = createFabricMaterial(0xb3a17b, undefined, { disableShimmer: true }); // ACU — tan canvas satchel (was 0x6e5d44 dark brown — dominated the silhouette against the off-white outfit)
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
    // ACK realism: fuller, rounder cranium dome (was pointy/ovoid on top) +
    // cleaner cheek→jaw→chin taper → a more skull-like silhouette.
    new THREE.Vector2(0, +HEAD_R * 1.12),              // crown cap top
    new THREE.Vector2(HEAD_R * 0.50, +HEAD_R * 1.10),  // crown — rounder
    new THREE.Vector2(HEAD_R * 0.80, +HEAD_R * 1.00),  // upper cranium (fuller dome)
    new THREE.Vector2(HEAD_R * 0.97, +HEAD_R * 0.78),  // back-cranium fullness
    new THREE.Vector2(HEAD_R * 1.02, +HEAD_R * 0.45),  // cranium widest (temple)
    new THREE.Vector2(HEAD_R * 1.00, +HEAD_R * 0.18),  // brow ridge
    new THREE.Vector2(HEAD_R * 0.97, -HEAD_R * 0.08),  // cheekbone
    new THREE.Vector2(HEAD_R * 0.88, -HEAD_R * 0.34),  // cheek taper
    new THREE.Vector2(HEAD_R * 0.72, -HEAD_R * 0.58),  // jaw line
    new THREE.Vector2(HEAD_R * 0.50, -HEAD_R * 0.84),  // chin
    new THREE.Vector2(HEAD_R * 0.26, -HEAD_R * 1.00),  // under-chin
    new THREE.Vector2(0, -HEAD_R * 1.05),              // bottom cap
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
    collarMat,   // ACU — cloth collar (was bare skinMat)
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
    scarfMat,   // PM-B.3: distinct cloth tone (was hoodMat/skin-blend)
  );
  bandana.position.set(0, -HEAD_R * 0.22, HEAD_R * 0.14);
  bandana.rotation.x = Math.PI / 2;
  bandana.scale.set(1.0, 0.92, 0.62);     // flatten + push back to wrap face
  headGroup.add(bandana);

  // ── Face features (PM-B.2, ACJ): goggles + brow + nose bridge ──
  // The head is a Lathe of revolution → no front features by construction, so
  // the face read as a blank tan ovoid (mannequin). The lower face is covered
  // by the scarf wrap (bandana above); here we add the scavenger SIGNATURE —
  // goggles on the brow/eye line — plus a brow ridge above and a nose bridge
  // peeking between the goggles and the scarf. Face = +Z; offsets in HEAD_R so
  // they scale with the head. Iterated via rigStudio('head') (PM-B.2).
  const goggleFrameMat = createFabricMaterial(0x2b2620, undefined, { disableShimmer: true });   // dark rubber/leather strap
  // ACK realism: glossy dark glass — low roughness + some metalness → catches a
  // sharp specular glint from the key/rim light, reading as a real reflective
  // lens instead of a flat black disc (the cartoonish tell on the face).
  const goggleLensMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.13, metalness: 0.55 });
  const goggleRimMat = createMetalMaterial(0x6a5a3a, { wornScale: 10.0, scratchStrength: 0.20, localSpace: true });  // scavenged brass rim (ACT — localSpace D109; rig moves)
  const GOG_Y = HEAD_R * 0.20;            // eye line (slightly above center)
  const GOG_Z = HEAD_R * 0.95;            // ON the face surface (radius ~0.97R here)
  // Two lenses on the +Z face — smoked-glass disc in a brass rim, toed out to
  // follow the cheek curve. (No full strap torus: the sides/back would be hidden
  // by the hood anyway, and a front-crossing torus reads as a bar over the
  // lenses. Connected by a thin bridge + short temple stubs instead.)
  for (const sx of [-1, 1]) {
    const lensX = sx * HEAD_R * 0.42;
    const toe = sx * 0.34;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R * 0.30, HEAD_R * 0.30, 0.026, 16), goggleRimMat);
    rim.rotation.x = Math.PI / 2;          // cylinder axis → +Z (lens faces forward)
    rim.rotation.y = toe;
    rim.position.set(lensX, GOG_Y, GOG_Z);
    headGroup.add(rim);
    // Convex lens dome (sphere flattened in Z) — a curved glass surface catches
    // a moving glint far better than a flat disc → reads as a real lens.
    const lens = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 0.23, 18, 12), goggleLensMat);
    lens.scale.set(1, 1, 0.5);
    lens.rotation.y = toe;
    lens.position.set(lensX, GOG_Y, GOG_Z + 0.012);
    headGroup.add(lens);
    // Temple strap stub — short band from the lens outer edge toward the ear
    // (tucks under the hood at the side).
    const strap = new THREE.Mesh(new THREE.BoxGeometry(HEAD_R * 0.55, 0.024, 0.030), goggleFrameMat);
    strap.position.set(sx * HEAD_R * 0.80, GOG_Y, GOG_Z - HEAD_R * 0.55);
    strap.rotation.y = sx * 0.95;          // angle back toward the temple
    headGroup.add(strap);
  }
  // Bridge between the lenses (thin connector across the nose).
  const goggleBridge = new THREE.Mesh(new THREE.BoxGeometry(HEAD_R * 0.30, 0.020, 0.026), goggleRimMat);
  goggleBridge.position.set(0, GOG_Y, GOG_Z + 0.004);
  headGroup.add(goggleBridge);
  // Brow ridge — subtle wedge just above the goggles.
  const brow = new THREE.Mesh(new THREE.BoxGeometry(HEAD_R * 0.92, HEAD_R * 0.10, HEAD_R * 0.14), skinMat);
  brow.position.set(0, GOG_Y + HEAD_R * 0.22, HEAD_R * 0.95);
  headGroup.add(brow);
  // Nose bridge — small wedge peeking between the goggles and the scarf.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(HEAD_R * 0.16, HEAD_R * 0.28, HEAD_R * 0.18), skinMat);
  nose.position.set(0, GOG_Y - HEAD_R * 0.30, HEAD_R * 0.95);
  headGroup.add(nose);

  // ── Lower-face scarf wrap (PM-B.3, ACJ) ──
  // Cloth pulled up over the nose-tip/mouth/chin — the desert-scavenger
  // signature, and what makes the lower face read as covered cloth rather than
  // a blank tan jaw. A sphere section hugging the lower-front of the head,
  // wrapping the cheeks back toward the hood. Sits just under the goggles +
  // upper nose bridge (those still read above the cloth). Face = +Z; phi=π/2 is
  // the +Z front (matches the hood's gap convention).
  const scarfMask = new THREE.Mesh(
    new THREE.SphereGeometry(
      HEAD_R * 1.13, 24, 18,             // stands proud of the skin so the cloth reads as a layer with edges
      Math.PI * -0.08, Math.PI * 1.16,   // phi: ~210° centered on +Z (front + both cheeks, wraps to the hood)
      Math.PI * 0.49, Math.PI * 0.47,    // theta: nose-tip line down past the chin
    ),
    scarfMat,
  );
  // Subtle fold displacement so the cloth doesn't read as a smooth shell.
  {
    const pa = scarfMask.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const theta = Math.atan2(z, x);
      const off = Math.sin(6 * theta) * 0.006 + Math.sin(11 * theta + y * 8) * 0.004;
      pa.setX(i, x + (x / r) * off);
      pa.setZ(i, z + (z / r) * off);
    }
    pa.needsUpdate = true;
    scarfMask.geometry.computeVertexNormals();
  }
  headGroup.add(scarfMask);

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
    // ACU — head-shape fix. CROWN_AMP 0.013 (≈10% radial lobing × 7 waves) made
    // the crown read as a segmented "melon/pumpkin". Dropped to a near-smooth
    // 0.003 so the hood is a clean rounded dome.
    const CROWN_WAVES = 7;
    const CROWN_AMP = 0.003;
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

  // ── Poncho REMOVED (ACJ) ──
  // The procedural folded-cylinder poncho read as stiff, unrealistic boxy
  // panels (a tube with sine-wave grooves, no real drape). Removed pending
  // PM-D cloth physics, which will reintroduce a properly simulated cloth
  // layer. With it gone, the torso↔limb junctions (shoulders, hips) that the
  // poncho was hiding are now exposed — fixed via filler geometry below.

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

  // ── Hips + legs: SkinnedMesh tubes (ACJ PM-S.2) ──
  // Same technique as the arms: one continuous tube per leg skinned to a
  // hip→knee→ankle bone chain, so the KNEE bends smoothly (no seam). Unlike
  // the arms, the leg MESH sits at body origin and the HIP BONE carries the
  // HIP_Y + lateral offset — because applyFootIK rewrites rig.hips[i].position.y
  // each frame to plant the foot on terrain, and that must translate the whole
  // leg (foot IK targets the hip bone exactly as it did the old hip pivot).
  const hips: THREE.Object3D[] = [];
  const knees: THREE.Object3D[] = [];
  const ankles: THREE.Object3D[] = [];
  const LEG_KNEE_Y = -UPPER_LEG_LEN;     // -0.45
  const LEG_ANKLE_Y = -LEG_LEN;          // -0.85
  // Combined leg profile in hip-local space (y: 0 at hip → -LEG_LEN at ankle).
  // Merges the old thigh + shin profiles into one tube with a continuous knee
  // + blend rings; radii preserve the ABY quad/calf swells.
  const legProfile = [
    new THREE.Vector2(0.0,   0.0),         // hip cap
    new THREE.Vector2(0.095, -0.01),       // thigh top
    new THREE.Vector2(0.105, -0.101),      // quad swell (widest)
    new THREE.Vector2(0.088, -0.225),      // mid thigh
    new THREE.Vector2(0.068, -0.371),      // lower thigh taper
    new THREE.Vector2(0.060, -0.420),      // knee approach (blend ring)
    new THREE.Vector2(0.058, -0.440),      // knee top
    new THREE.Vector2(0.058, -0.460),      // knee bottom (continuous joint)
    new THREE.Vector2(0.062, -0.500),      // calf start (blend ring)
    new THREE.Vector2(0.068, -0.560),      // upper calf
    new THREE.Vector2(0.078, -0.600),      // calf
    new THREE.Vector2(0.082, -0.630),      // calf widest
    new THREE.Vector2(0.072, -0.670),      // post-peak
    new THREE.Vector2(0.060, -0.710),      // mid shin
    new THREE.Vector2(0.045, -0.800),      // lower shin
    new THREE.Vector2(0.040, -0.845),      // ankle
    new THREE.Vector2(0.0,   LEG_ANKLE_Y), // ankle cap
  ];
  const legMat = trouserMat.clone();  legMat.side = THREE.DoubleSide;  // ACU — trousers (was bare skin underclothMat)
  for (const side of [-1, 1]) {
    const leg = buildSkinnedLimb({
      profile: legProfile,
      radialSegments: 16,
      midY: LEG_KNEE_Y,
      endY: LEG_ANKLE_Y,
      blendBand: 0.08,
      material: legMat,
    });
    leg.mesh.position.set(0, 0, 0);
    body.add(leg.mesh);                 // legs stay on body, NOT spineBend
    const hipBone = leg.rootBone;
    const kneeBone = leg.midBone;
    const ankleBone = leg.endBone;
    // Hip bone carries lateral + HIP_Y offset (applyFootIK rewrites .y).
    hipBone.position.set(side * HIP_LATERAL, HIP_Y, 0);

    // Boot wraps — cloth bands on the lower shin, riding the knee bone.
    const BOOT_BANDS = 5;
    for (let b = 0; b < BOOT_BANDS; b++) {
      const t = b / (BOOT_BANDS - 1);
      const bandR = 0.060 - t * 0.018;
      const bw = new THREE.Mesh(new THREE.TorusGeometry(bandR, 0.011, 6, 14), wrapMat);
      bw.position.y = -LOWER_LEG_LEN * (0.46 + t * 0.46);   // below the knee, on the shin
      bw.rotation.x = Math.PI / 2;
      bw.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.05;
      kneeBone.add(bw);
    }

    // Boot (ACK realism) — was 2 plain boxes (a "lego foot"). Now a sole slab +
    // upper + ROUNDED toe cap + heel → reads as a worn boot. Rigid children of
    // the ankle bone (ankle rotation drives heel-toe roll).
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.090, 0.024, 0.210), underclothMat);
    sole.position.set(0, -0.046, 0.050);
    ankleBone.add(sole);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.058, 0.150), underclothMat);
    foot.position.set(0, -0.016, 0.040);
    ankleBone.add(foot);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 9), underclothMat);
    toe.scale.set(0.92, 0.62, 1.0);              // rounded toe bumper
    toe.position.set(0, -0.020, 0.140);
    ankleBone.add(toe);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.040, 0.045), underclothMat);
    heel.position.set(0, -0.030, -0.028);        // slight heel block at the back
    ankleBone.add(heel);

    // Hip-cap filler (ACJ) — sphere bridging the thigh top to the pelvis, the
    // same trick the deltoid uses for shoulders. Rides the hip bone (so the
    // thigh always has a rounded glute/hip top); sized to reach the centerline
    // so the two caps + the widened pelvis read as one continuous hip mass
    // instead of legs bolted onto a narrow blob. (Exposed by removing the poncho;
    // proper fix is torso skinning — PM-S.3.)
    const hipFill = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 12), trouserMat); // ACU — hip clothed
    hipFill.position.set(0, 0.015, -0.005);
    hipFill.scale.set(1.0, 0.95, 1.08);
    hipBone.add(hipFill);

    hips.push(hipBone);
    knees.push(kneeBone);
    ankles.push(ankleBone);
  }

  // ── Shoulders + arms: SkinnedMesh tubes (ACJ PM-S.1) ──
  // Pre-ACJ each arm was 2 rigid Lathe meshes (upper arm + forearm) parented
  // at separate Groups, so the ELBOW was a hard seam and the hand jutted off
  // the wrist as a disconnected block — the "rotated weirdly / not connecting"
  // bug. Now: ONE continuous tube per arm, skinned to a shoulder→elbow→wrist
  // bone chain, so the elbow bends SMOOTHLY (vertices blend across the joint).
  // Still procedural (D107) — geometry + weights generated in skinnedLimb.ts.
  // The bones REPLACE the old pivot Groups; the animation tick rotates them
  // identically (Bone extends Object3D). Decorations (deltoid cap, forearm
  // wraps, hand) attach as rigid children of the bones.
  const shoulders: THREE.Object3D[] = [];
  const elbows: THREE.Object3D[] = [];
  const wrists: THREE.Object3D[] = [];
  let rightHandAttach: THREE.Group | null = null;
  // Combined arm profile in shoulder-local space (y: 0 at shoulder → -ARM_LEN
  // at wrist). Merges the old upper-arm + forearm profiles into one tube with a
  // continuous (non-zero-radius) elbow + extra rings around the joint so the
  // skin blend bends smoothly instead of faceting. Radii preserve the ABY
  // deltoid/bicep/forearm swells.
  const ARM_ELBOW_Y = -UPPER_ARM_LEN;          // -0.32
  const ARM_WRIST_Y = -ARM_LEN;                // -0.65
  const armProfile = [
    new THREE.Vector2(0.0,   0.0),             // shoulder cap
    new THREE.Vector2(0.072, -0.01),           // deltoid top
    new THREE.Vector2(0.080, -0.088),          // upper bicep
    new THREE.Vector2(0.082, -0.128),          // bicep peak
    new THREE.Vector2(0.072, -0.168),          // post-peak fall
    new THREE.Vector2(0.060, -0.208),          // mid arm taper
    new THREE.Vector2(0.052, -0.265),          // elbow approach (blend ring)
    new THREE.Vector2(0.046, -0.310),          // elbow top
    new THREE.Vector2(0.046, -0.330),          // elbow bottom (continuous joint)
    new THREE.Vector2(0.049, -0.370),          // forearm start (blend ring)
    new THREE.Vector2(0.054, -0.436),          // forearm bulk
    new THREE.Vector2(0.045, -0.543),          // mid forearm
    new THREE.Vector2(0.034, -0.645),          // wrist
    new THREE.Vector2(0.0,   ARM_WRIST_Y),     // wrist cap
  ];
  const armMat = sleeveMat.clone();  armMat.side = THREE.DoubleSide;  // ACU — sleeved (was bare skin underclothMat)
  for (const side of [-1, 1]) {
    const arm = buildSkinnedLimb({
      profile: armProfile,
      radialSegments: 14,
      midY: ARM_ELBOW_Y,
      endY: ARM_WRIST_Y,
      blendBand: 0.075,
      material: armMat,
    });
    arm.mesh.position.set(side * SHOULDER_LATERAL, SHOULDER_Y, 0);
    spineBend.add(arm.mesh);            // ABV — arms bend with spine
    const shoulderBone = arm.rootBone;
    const elbowBone = arm.midBone;
    const wristBone = arm.endBone;

    // Deltoid cap — sphere over the shoulder bridging the arm-to-torso gap.
    // ACJ: enlarged + spread (the poncho used to hide this junction).
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 10), sleeveMat); // ACU — shoulder clothed
    deltoid.position.set(0, 0.005, 0);
    deltoid.scale.set(1.08, 0.80, 1.05);
    shoulderBone.add(deltoid);

    // Forearm wraps — tight band stack on the mid-forearm, riding the elbow
    // bone rigidly (positions relative to the elbow joint, same look as pre-ACJ).
    const WRAP_BANDS = 7;
    for (let w = 0; w < WRAP_BANDS; w++) {
      const t = w / (WRAP_BANDS - 1);
      const bandR = 0.052 - t * 0.012;
      const bandTube = 0.0105 + (w % 2) * 0.0025;
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(bandR, bandTube, 6, 14), wrapMat);
      wrap.position.y = -0.05 - w * 0.019;        // forearm span below the elbow
      wrap.rotation.x = Math.PI / 2;
      wrap.rotation.z = (w % 2 === 0 ? 1 : -1) * 0.05;
      elbowBone.add(wrap);
    }

    // Hand — rigid child of the wrist bone. ACJ orientation fix: the hand now
    // CONTINUES the arm (fingers hang down-and-forward like a relaxed hand)
    // instead of jutting straight forward off a vertical forearm. The handGroup
    // is rotated so the finger axis (-Z) drops down-forward; the wrist bone's
    // small animated rotation rides on top.
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.02, 0);
    handGroup.rotation.x = -1.15;                 // relaxed down-forward hang (was flat-forward block)
    wristBone.add(handGroup);
    // Fingerless glove — palm + knuckle ridge in wrap cloth, fingers bare skin.
    // ACK realism: slimmer palm + relaxed CURLED fingers (a real resting hand
    // curls; stiff splayed digits read blocky/mannequin).
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.024, 0.058), wrapMat);
    palm.scale.set(1, 1, 1);
    handGroup.add(palm);
    const knuckleRidge = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.019, 0.020), wrapMat);
    knuckleRidge.position.set(0, 0, -0.026);
    handGroup.add(knuckleRidge);
    for (let f = 0; f < 4; f++) {
      const fingerLen = 0.058 - Math.abs(f - 1.5) * 0.006;
      // Tapered + slimmer; outer fingers (index/pinky) curl a touch more → a
      // natural relaxed cup rather than a flat splay.
      const curl = 0.62 + Math.abs(f - 1.5) * 0.10;
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0085, fingerLen, 8), handSkinMat);
      finger.rotation.x = Math.PI / 2 - curl;             // more relaxed curl (was 0.35)
      finger.rotation.z = (-0.027 + f * 0.018) * 0.6;     // fan/converge slightly toward the palm center
      finger.position.set(-0.025 + f * 0.0165, -fingerLen * 0.30, -0.026 - fingerLen * 0.40);
      handGroup.add(finger);
      for (const frac of [1 / 3, 2 / 3]) {
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0098, 6, 5), handSkinMat);
        knuckle.position.y = (frac - 0.5) * fingerLen;
        finger.add(knuckle);
      }
    }
    // Thumb — the only asymmetric digit, so MIRROR it per side (handSign):
    // pre-ACJ both arms used the identical hand, making the left a second right
    // hand (thumb on the wrong/lateral side). Negate the thumb's X offset + its
    // Z splay for the left arm so the two hands are a proper mirrored pair, with
    // each thumb on the INNER (body-ward) side. Fingers stay unmirrored (their
    // arrangement is X-symmetric).
    const handSign = side;   // +1 right arm, -1 left arm
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.054, 8), handSkinMat);
    thumb.rotation.z = handSign * 0.7;          // splay toward the body midline
    thumb.rotation.x = Math.PI / 2 - 0.5;
    thumb.position.set(handSign * -0.038, -0.012, -0.014);
    handGroup.add(thumb);
    // Right-hand attach point for 3P held items. ACX FIX: the rig faces local
    // +Z, so the player's RIGHT side is local -X = side -1 (NOT +1). Pre-ACX
    // this lived on side +1 (the player's LEFT hand) — the "item in the wrong
    // hand" bug. side -1 is pushed first → shoulders/elbows/wrists index 0, so
    // the aim-twist + 3P use-anims (which target the held-item arm) also move
    // to index 0.
    if (side === -1) {
      rightHandAttach = new THREE.Group();
      rightHandAttach.position.set(0, -0.04, 0.04);
      // ACX — orient the attach frame so a held item points the player's
      // FORWARD in the idle pose (the raw hand frame has forward ≈ down-the-
      // hand, which is why default items pointed at the ground/out to the side).
      // Measured via rig-shot rig3p: in the hand-attach local frame, the
      // player's world-forward ≈ (-0.16,-0.89,0.42) and world-up ≈
      // (0.02,0.43,0.9). Build a basis so attach-local -Z = forward, +Y = up —
      // then guns (barrel -Z) need no per-item rotation and blades (+Y) need a
      // simple -90° X. The corrective lives on the attach (NOT handGroup) so it
      // doesn't touch the visible hand mesh; it rides the gait with the arm.
      const lf = new THREE.Vector3(-0.16, -0.89, 0.42).normalize();
      const lu = new THREE.Vector3(0.02, 0.43, 0.9).normalize();
      const zImg = lf.clone().negate();                            // -Z → forward
      const xImg = new THREE.Vector3().crossVectors(lu, zImg).normalize();
      const yImg = new THREE.Vector3().crossVectors(zImg, xImg).normalize();
      rightHandAttach.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xImg, yImg, zImg),
      );
      handGroup.add(rightHandAttach);
    }
    shoulders.push(shoulderBone);
    elbows.push(elbowBone);
    wrists.push(wristBone);
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
    _aimTwist: 0,   // ACL AIM TWIST-IK
    _aimPrevHeading: 0, // ACN — for camera turn-rate derivation
  };
  return rig;
}

/** Per-frame update: position + heading + state classification + gait.
 *  ABP Tier 2 — 3-phase walk cycle + knee/elbow flex + foot IK + head
 *  counter-bob. */
export function updatePlayerRig(ctx: GameContext, dt: number): void {
  const rig = ctx.player.rig;
  if (!rig) return;

  // ── Gait bookkeeping — runs in BOTH camera modes (FP and 3P). ──
  // ACT FIX: this block previously sat BELOW the visibility early-return, so
  // in first person rig.speedMag / state / stepCount never advanced. But
  // controller.ts drives footstep AUDIO and footprint DECALS off rig.stepCount
  // — so in FP both silently died (footprints + steps only appeared in 3P).
  // The cheap state + gait-phase bookkeeping now runs unconditionally; only
  // the visual transform work (position / heading / bone posing) stays gated
  // below the visibility check.
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

  const t = ctx.time.elapsed;
  const isWalking = rig.state === 'walking' || rig.state === 'running';

  // Gait amplitudes + global phase. ABQ R1: amplitudes bumped — pre-R1 read
  // as "subtle" rather than a clear walk; was hipAmp=0.40/0.55,
  // armAmp=hipAmp*0.85. Walk now reads at 3P distance. (Hoisted out of the
  // bone block so the step-count math below runs in FP too; the bone posing
  // in 3P reuses these.)
  const gaitFreq = rig.state === 'walking' ? 1.6 : 2.4;
  const phase = t * gaitFreq * _PI2;
  const hipAmp = rig.state === 'walking' ? 0.48 : 0.62;
  const armAmp = hipAmp * 0.95;

  // ABY P1 — step counter increment. Heel-strikes happen at
  // legPhase = π/2, 3π/2, 5π/2, ... (sin peaks of opposite-leg pair),
  // so the GLOBAL phase passes a step-boundary every π radians offset
  // from π/2. Track _lastStepPhase; count how many π-spaced
  // boundaries (offset π/2) we've crossed since last frame.
  if (isWalking) {
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

  // ── Visibility gate — visual transforms only past here. ──
  rig.group.visible = ctx.flags.thirdPerson;
  if (!rig.group.visible) {
    // Keep the aim-twist turn-rate baseline synced so 3P re-entry is smooth.
    rig._aimPrevHeading = rig.heading;
    return;
  }

  // ── ACV #148 — SEATED ON THE SPEEDER. ──
  // While mounted, the player capsule is parked far below the world (speeder.ts
  // sets it to y=-2000), so the normal "position the rig at the body" path below
  // would drop the rig underground / snap it to the origin — the "3P rig broken
  // on the speeder" bug. Instead seat the rig ON the bike: place its origin at
  // the rider seat (bike body + a yaw-rotated local offset, matching the
  // rider-seat math in speeder.ts), face the bike's forward, and hold a seated
  // pose. The camera already follows the rider seat from speeder.ts; a dedicated
  // speeder 3P camera is deferred. SEAT_Y/Z are foreground-tunable.
  const sp = ctx.speeder;
  if (sp && sp.mounted) {
    const bt = sp.body.translation();
    const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw);
    const sz = Tuning.SPEEDER_RIG_SEAT_Z;            // local +Z (back), x=0
    rig.group.position.set(bt.x + sz * s, bt.y + Tuning.SPEEDER_RIG_SEAT_Y, bt.z + sz * c);
    rig.heading = sp.yaw + Math.PI;                  // face the bike's forward (-Z local)
    rig.group.rotation.y = rig.heading;
    rig.state = 'idle';
    // ACX — RIDING pose: lean forward over the tank, both hands reaching
    // forward+down to the handlebar grips (bars are ~0.77m up + 0.28m fwd of
    // the seat origin), knees bent up astride the chassis with shins dropping
    // to the footpegs (fwd + out + low). Tuned in the speeder-seated harness.
    for (let i = 0; i < 2; i++) {
      const side = i === 1 ? 1 : -1;
      // Legs: thigh forward + splayed astride, shin bent down/forward to the peg.
      rig.hips[i].rotation.set(1.25, 0, side * 0.22);
      rig.knees[i].rotation.x = 1.35;
      rig.ankles[i].rotation.x = 0.25;
      // Arms: reach forward to the bars — shoulder well forward + slightly in,
      // elbow bent so the hands come up to bar height, wrist cocked to grip.
      rig.shoulders[i].rotation.set(1.15, 0, side * 0.12);
      rig.elbows[i].rotation.x = 0.85;
      rig.wrists[i].rotation.x = 0.15;
    }
    rig.body.position.set(0, 0, 0);
    rig.body.rotation.x = 0;
    rig.spineBend.rotation.set(0.34, 0, 0);            // forward lean onto the bars
    rig.headGroup.position.y = HEAD_Y;
    rig._aimPrevHeading = rig.heading;
    return;
  }

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

  // Animate per state
  if (isWalking) {
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

  // ACL AIM TWIST-IK — upper-body aim twist on the RIGHT shoulder.
  // When in 3P, the whole rig already faces rig.heading (= camera horizontal
  // heading, set above at L991-999). We add a SUBTLE additive yaw on the right
  // shoulder so the gun/lead arm leads slightly toward where the camera is
  // pointing relative to the body's facing — reads as "aiming"/tracking.
  // Composed on .rotation.y so it never clobbers the swing X-rotation set in
  // the per-state arm-swing blocks above.
  if (ctx.flags.thirdPerson) {
    // ACN — DYNAMIC aim-lead. `rig.heading` snaps to the camera heading every
    // frame (L1002), so the static (camHeading - bodyHeading) delta is ~0 —
    // which is why the ACL version fell back to a constant. The real dynamic
    // signal is the camera TURN RATE: when the player whips the view, the
    // upper body winds INTO the turn, then relaxes to the resting bias when
    // steady. We diff heading vs last frame, normalise by dt → rad/sec, and
    // lead by that (clamped). Composed on .rotation.y only so it never
    // clobbers the swing X-rotation set in the per-state arm blocks above.
    let dh = rig.heading - rig._aimPrevHeading;
    if (dh > Math.PI) dh -= _PI2; else if (dh < -Math.PI) dh += _PI2; // wrap to [-π,π]
    rig._aimPrevHeading = rig.heading;
    const turnRate = dt > 1e-5 ? dh / dt : 0;          // rad/sec (signed)
    const turnLead = turnRate * AIM_TWIST_TURN_GAIN;   // lead winds into the turn
    const aimTwistTarget = THREE.MathUtils.clamp(
      AIM_TWIST_BIAS + turnLead,
      -AIM_TWIST_CLAMP,
      AIM_TWIST_CLAMP,
    );
    rig._aimTwist += (aimTwistTarget - rig._aimTwist) * AIM_TWIST_LERP;
    rig.shoulders[0].rotation.y = rig._aimTwist;   // ACX — index 0 = player's RIGHT arm (held-item/aim arm)
  } else if (rig._aimTwist !== 0) {
    // Decay back to neutral when not in 3P so re-entry is smooth.
    rig._aimPrevHeading = rig.heading;
    rig._aimTwist += (0 - rig._aimTwist) * AIM_TWIST_LERP;
    rig.shoulders[0].rotation.y = rig._aimTwist;   // ACX — index 0 = player's RIGHT arm (held-item/aim arm)
  }

  // ── ACW Phase A — 3P USE-ANIMATION. ──
  // The FP viewmodel item is hidden in 3P, so an FP-only `playUseAnim` would
  // show no arm motion when the player swings/drinks/fires with the camera
  // behind the body. When a viewmodel use-anim is active AND we're in 3P,
  // drive the held item's `playUseAnim3P` to pose the rig's right arm. Runs
  // LAST (after the per-state arm swing + aim-twist) so it overrides them for
  // the duration of the action; the gait/idle block re-poses the arm the
  // frame after the anim ends.
  if (ctx.flags.thirdPerson) {
    const vm = ctx.player.viewModel;
    if (vm && vm.anim.active && vm.anim.itemId !== null && vm.anim.duration > 0) {
      const def = getItemDef(vm.anim.itemId);
      if (def.playUseAnim3P) {
        const t3 = Math.min(1, Math.max(0,
          (performance.now() / 1000 - vm.anim.startTime) / vm.anim.duration));
        def.playUseAnim3P(rig, t3);
      }
    }
  }
}

// ACL AIM TWIST-IK tuning — promoted to Tuning (integration).
// Subtle upper-body aim lead on the right (lead/gun) shoulder when in 3P.
const AIM_TWIST_BIAS = Tuning.AIM_TWIST_BIAS;    // resting twist (rad) when not turning
const AIM_TWIST_CLAMP = Tuning.AIM_TWIST_CLAMP;  // hard clamp on aim twist (±rad)
const AIM_TWIST_LERP = Tuning.AIM_TWIST_LERP;    // per-frame lerp toward target (smoothing)
const AIM_TWIST_TURN_GAIN = Tuning.AIM_TWIST_TURN_GAIN; // rad lead per rad/sec camera turn (ACN)

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
