// Skeleton primitive (Session W). Hand-coded composite positioned to read
// as "slumped against the back wall, died writing." All bones are simple
// THREE.js primitives — no rigging, no animation. The group origin is at
// the floor between the skeleton's feet so the caller positions it relative
// to the floor of the shelter.
//
// Orientation convention: the skeleton faces +Z (forward, away from back
// wall). Back wall sits behind on -Z; the right hand extends along +Z
// toward where the journal lies.

// ── DEEPER cycle 12 — THE CLOSE-READ PATH (`makeSkeleton({ closeRead: true })`). ─────────────────
// The figure below was authored for a DIM WRECK read at 2-4m, where it works. The dead-explorer
// tableau reads it at TORCH RANGE, 1-2m, kneeling over it, and at that distance it fails in ways
// that are invisible at 2.6m by construction:
//   • the eye sockets are `CircleGeometry` — a single zero-thickness face that VANISHES edge-on, on
//     the one feature a player puts their face against (rule 7, on the worst possible mesh);
//   • the ribcage's four half-tori lie in the SAGITTAL plane, so at torch range it reads as a
//     COIL SPRING, and each half-torus has two open, zero-thickness tube mouths;
//   • the limbs are 5-segment cylinders whose joints do not meet — at 1m the arms are visibly
//     DETACHED sticks floating beside the body, and both legs are authored BELOW y=0 (the femur's
//     +1.05 rad pitch swings the bone backwards, not forwards), i.e. buried under the floor.
// So the close-read path is a separate builder that keeps the STAGING intent exactly — slumped
// against the back wall, head fallen forward, right arm out where the journal slipped from it, left
// hand in the lap — and rebuilds the FORMS on real joint chains: every bone is a closed, capped
// `sweptTube` (the hero-ribcage function `boneScatter.ts` already shares) with epiphysis flares at
// both ends so nothing tapers to a blade, joints are knuckled so nothing floats, and the orbits are
// a real concave dish displaced into a solid skull.
//
// Rule 7 / the SPELEO_TIP_FLOOR lesson (`caveGen.ts:502-508`, whose comment is verbatim the critique
// that lands here — "at arm's length that is a paper shaving"): every radius array in this file is
// clamped to `BONE_TIP_FLOOR × r`, and a real bone is WIDEST at its ends anyway.
//
// TONE: sad and quiet, never a scare. No teeth (a dentition is a rictus grin at 1m), no contortion,
// no blood, the head fallen forward like sleep. The one fracture in the tableau is a rib that has
// come away and lies beside the body — decay and time, not violence.
//
// COLOUR: `createBoneMaterial(0x8a7d68, …)` per D252 / `deepCave.ts:42` — muted DRIED old bone. NOT
// `heroBoneMaterial`: its registered emissive is a SUN-cancelling device that goes to zero
// underground, and its weathering is tuned for a 50-70m read.
//
// The whole figure merges into ONE geometry per material (2 draw calls: bone + socket void), which
// is also why the parts can be as detailed as a 1m read needs.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBoneMaterial } from './boneMaterial.ts';
import { sweptTube } from './giantRibcage.ts';

// ABJ — Tier 2 C4: procedural bone shader (cracks + mineralization +
// age-bleach + micro-grain). Pre-ABJ the skeleton was flat Lambert
// (one ivory tone). World-space sampling means cracks vary across
// each bone instance for free.
const _boneMat = createBoneMaterial(0xd6c8a8, {
  crackDensity: 1.2,
  marrowHint: 0.55,
  ageBleach: 0.4,
});
const _socketMat = new THREE.MeshLambertMaterial({
  color: 0x14110a,
  flatShading: true,
});

function box(w: number, h: number, d: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _boneMat);
}

function cylinder(r: number, h: number, segs = 6): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), _boneMat);
}

export interface SkeletonOpts {
  /** Build the CLOSE-READ figure (the dead-explorer tableau, read at 1-2m by torchlight) instead of
   *  the shipped 2-4m wreck skeleton. Default false — and the default path below is the ORIGINAL
   *  function body, untouched, reached before this flag is ever consulted, so the three surface call
   *  sites (`openingScene.ts:175`, `wordlessScenes.ts:176`/`:193`) cannot move by a vertex. */
  closeRead?: boolean;
}

export function makeSkeleton(opts: SkeletonOpts = {}): THREE.Group {
  if (opts.closeRead) return makeCloseReadSkeleton();
  const g = new THREE.Group();

  // ── Pelvis: sits on floor against the back wall (-Z side). ─────────────
  const pelvis = box(0.30, 0.10, 0.22);
  pelvis.position.set(0, 0.10, -0.22);
  g.add(pelvis);

  // ── Spine: 5 vertebrae stacking up the back wall, tilted ~20° forward.
  // The lean creates the "slumped" silhouette — torso falls toward the legs.
  const spineLean = -0.35; // radians (~20°) — top of spine leans forward (+Z)
  const spineBase = new THREE.Group();
  spineBase.position.set(0, 0.15, -0.20);
  spineBase.rotation.x = spineLean;
  g.add(spineBase);
  for (let i = 0; i < 5; i++) {
    const v = cylinder(0.05, 0.10);
    v.position.y = 0.08 + i * 0.11;
    spineBase.add(v);
  }

  // ── Ribcage: 4 half-torus arcs around the upper torso (attached to spine
  // so they tilt with it). Open at the front (player can see "into" the
  // chest cavity from the inside-the-wreck side).
  const torsoTop = new THREE.Group();
  torsoTop.position.y = 0.55; // top of the spine (above 5 vertebrae)
  spineBase.add(torsoTop);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      // Half-torus (Math.PI arc) opening forward (+Z is the gap)
      new THREE.TorusGeometry(0.15, 0.012, 4, 10, Math.PI),
      _boneMat,
    );
    ring.position.y = -i * 0.08;
    // Default torus lies in XY plane; rotate so its plane is horizontal
    // (XZ) and the arc opens forward.
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = Math.PI / 2;
    torsoTop.add(ring);
  }

  // ── Skull: seated just above the ribcage top (was 0.78 — a floating-head gap;
  // lowered to 0.64 so it reads as a skull on a neck, not a hovering ball). Slightly
  // ellipsoidal (taller than wide) so it reads as a skull, not a sphere. ──────────
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), _boneMat);
  skull.scale.set(0.92, 1.08, 1.0);
  skull.position.set(0, 0.64, 0.01);
  skull.rotation.x = 0.25;       // additional forward tilt on top of spine lean
  skull.name = 'skullLegacy';    // the socket probe frames this by name
  spineBase.add(skull);
  // ── Eye sockets — SOLID TAPERING RECESSES, not discs (rule 7, fixed 2026-07-29 on Zach's call).
  //
  // WHAT WAS WRONG. These were `CircleGeometry(0.032, 10)` — ONE ZERO-THICKNESS FACE each. Face-on
  // they read as sockets; at any turn they thin to a line and then vanish, and the skull becomes a
  // smooth ball with no eyes at all. `scen-sockets-turn70-before.png` is that exact frame at 70°:
  // both sockets gone. This is the game's FIRST IMPRESSION (`openingScene.ts`) and it is rule 7 on
  // the one feature a player looks straight at.
  //
  // THE FIX. A near-black solid FRUSTUM sunk into the cranium per eye: wide mouth at the surface,
  // narrowing 3cm inward. It is a closed body with real depth, so from any bearing what you see is a
  // tapering hole with a rim rather than a face that happens to be edge-on. Same principle the
  // close-read cave skull uses; this is the cheap version of it that does not need a displaced
  // cranium, so the shipped silhouette is unchanged.
  //
  // Parented to the SKULL, not to `spineBase`, deliberately: the skull carries its own rotation and
  // a non-uniform scale, and the old sockets were positioned by hand-derived numbers in the parent's
  // frame — which is why they sat ~2cm INSIDE the surface. As children, direction × radius puts them
  // on the sphere by construction and they inherit the squash, so they cannot drift if the skull is
  // ever re-proportioned. `SOCK_PROUD` clears the facet inset: an 80-face icosahedron's facet
  // centres sit a few mm inside its circumsphere, so a rim exactly at r would be buried by the flat.
  // r1 → r2 (shot, not taste): at 0.030 radius, set high and wide and standing 6mm proud, these read
  // as ALIEN GOGGLES face-on — two big dark ovals covering a third of the face. A real orbit is about
  // a quarter of the face's width. Smaller, set lower and closer together, and barely proud so the
  // TAPER does the work instead of the rim. (The close-read cave skull hit this same failure at its
  // own round 2; recorded here so a third skull does not.)
  const SOCK_R_OUT = 0.021, SOCK_R_IN = 0.007, SOCK_DEPTH = 0.026, SOCK_PROUD = 0.002;
  const SKULL_R = 0.11;
  for (const sx of [-1, 1]) {
    const dir = new THREE.Vector3(sx * 0.34, 0.16, 0.92).normalize();
    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(SOCK_R_OUT, SOCK_R_IN, SOCK_DEPTH, 12),
      _socketMat,
    );
    socket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);   // +Y (the wide end) → outward
    socket.position.copy(dir).multiplyScalar(SKULL_R + SOCK_PROUD - SOCK_DEPTH * 0.5);
    skull.add(socket);
  }
  const nasal = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.045, 3), _socketMat);
  nasal.position.set(0, 0.608, 0.094);
  nasal.rotation.set(Math.PI, 0, 0);          // inverted triangle (point down)
  spineBase.add(nasal);
  const brow = box(0.105, 0.02, 0.032);       // bone brow ridge over the sockets
  brow.position.set(0, 0.7, 0.072);
  brow.rotation.x = 0.22;
  spineBase.add(brow);
  // Jaw — small box under the skull
  const jaw = box(0.092, 0.045, 0.067);
  jaw.position.set(0, 0.562, 0.052);
  spineBase.add(jaw);

  // ── Left arm: bent at elbow, hand on lap. Lives in world space (not on
  // the leaned spine) so it rests naturally on the pelvis. ────────────────
  const lShoulder = new THREE.Group();
  lShoulder.position.set(-0.13, 0.55, -0.18);
  g.add(lShoulder);
  const lUpperArm = cylinder(0.025, 0.28, 5);
  lUpperArm.geometry.translate(0, -0.14, 0);
  lUpperArm.rotation.z = -0.3;
  lUpperArm.rotation.x = 0.45;
  lShoulder.add(lUpperArm);
  const lForearm = cylinder(0.022, 0.26, 5);
  lForearm.geometry.translate(0, -0.13, 0);
  lForearm.position.set(-0.05, -0.27, 0.10);
  lForearm.rotation.z = -0.7;
  lForearm.rotation.x = 1.4;
  lShoulder.add(lForearm);
  const lHand = box(0.06, 0.03, 0.07);
  lHand.position.set(-0.12, -0.30, 0.28);
  lShoulder.add(lHand);

  // ── Right arm: extended forward along the floor, hand reaching toward
  // the journal (positioned ~0.65 along +Z from skeleton origin). ─────────
  const rShoulder = new THREE.Group();
  rShoulder.position.set(0.13, 0.55, -0.18);
  g.add(rShoulder);
  const rUpperArm = cylinder(0.025, 0.30, 5);
  rUpperArm.geometry.translate(0, -0.15, 0);
  rUpperArm.rotation.z = 0.15;
  rUpperArm.rotation.x = 1.2; // arm angles forward + down
  rShoulder.add(rUpperArm);
  const rForearm = cylinder(0.022, 0.32, 5);
  rForearm.geometry.translate(0, -0.16, 0);
  rForearm.position.set(0.04, -0.32, 0.20);
  rForearm.rotation.x = 1.55; // nearly horizontal forward
  rShoulder.add(rForearm);
  const rHand = box(0.06, 0.03, 0.08);
  rHand.position.set(0.08, -0.45, 0.48);
  rShoulder.add(rHand);

  // ── Femurs + lower legs: pelvis → bent knees → feet flat on floor. ─────
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.10, 0.10, -0.12);
    g.add(hip);
    // Femur — angles forward + down toward knee.
    const femur = cylinder(0.030, 0.36, 5);
    femur.geometry.translate(0, -0.18, 0);
    femur.rotation.x = 1.05;      // ~60° forward
    hip.add(femur);
    // Knee + lower leg — bent forward of the body.
    const lower = cylinder(0.028, 0.36, 5);
    lower.geometry.translate(0, -0.18, 0);
    lower.position.set(0, -0.16, 0.31);
    lower.rotation.x = 0.10;
    hip.add(lower);
    // Foot
    const foot = box(0.08, 0.04, 0.16);
    foot.position.set(0, -0.34, 0.42);
    hip.add(foot);
  }

  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return g;
}

// ═══ THE CLOSE-READ FIGURE ═══════════════════════════════════════════════════════════════════════

/** Muted DRIED old bone (D252 / `deepCave.ts:42`), cracked and grimy at 1m. Module-shared: the beat
 *  is spawned and torn down per cave and the teardown idiom disposes GEOMETRY ONLY, so a
 *  per-instance material would leak one material + its compiled program per warren streamed. */
// crackDensity is 9, not the ~1.5 the surface skeleton uses, and that is a SCALE argument rather
// than a taste one: `boneMaterial` samples its crack FBM at `world.xz × 15 × density`, i.e. at
// density 1.5 the features are ~4cm across — on a 3cm-wide bone read at 1m that is not a hairline
// crack, it is a blotch, and r1 rendered as chipped paint. At 9 the network is ~4mm: hairline.
// The ALBEDO is dark on purpose (r2 → r3). At 1m the torch is ~0.5m from the bone and inverse-square
// blows a mid-tone out to near-white — 0x8a7d68 rendered as bright cream, i.e. exactly the "bright
// white bone" D252 exists to forbid. 0x655c4c renders as a dull grey-tan under the torch and still
// reads at the 4m arrival distance (checked in `beat`, both rounds).
const _boneMatCave = createBoneMaterial(0x655c4c, {
  crackDensity: 9.0,
  marrowHint: 0.45,
  ageBleach: 0.10,
  crackDepth: 0.5,
  weathering: 0.6,
});
/** The orbit / nasal VOID. Near-black, and a SOLID sunk into a real dish — never a facing disc. */
const _socketMatCave = new THREE.MeshLambertMaterial({ color: 0x0a0906 });

/** The tip-radius floor, × the shaft radius — the `SPELEO_TIP_FLOOR` contract restated for bone.
 *  Nothing in this figure may run out to a point: at arm's length a taper-to-zero is a paper
 *  shaving, and real long bones are widest at their ENDS anyway. */
const BONE_TIP_FLOOR = 0.62;

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

interface ShaftOpts {
  /** Lateral bow at mid-span (m). A perfectly straight tube reads as dowel. */
  bow?: number;
  bowDir?: THREE.Vector3;
  /** How much the ENDS swell over mid-shaft (the epiphyses). 0 = a constant tube. */
  flare?: number;
  /** Radius multiplier at `b` relative to `a` (still floored by BONE_TIP_FLOOR). */
  taper?: number;
  radial?: number;
  seg?: number;
  /** Seed for a JAGGED SPLINTERED FRACTURE at the `b` end (`sweptTube`'s jag pipeline) instead of
   *  the blunt dome. Used once in this figure, on the rib that has come away. */
  jag?: number;
}

/** One bone shaft, `a` → `b`: a closed, capped, parallel-transported tube with epiphysis swell at
 *  both ends. This is the hero-ribcage sweep the bone scatter already shares, so a snapped end shows
 *  a real splintered CROSS-SECTION rather than a lid in a pipe mouth. */
function shaft(a: THREE.Vector3, b: THREE.Vector3, r: number, o: ShaftOpts = {}): THREE.BufferGeometry {
  const seg = o.seg ?? 7;
  const flare = o.flare ?? 0.30;
  const taper = o.taper ?? 1.0;
  const bow = o.bow ?? 0;
  const dir = new THREE.Vector3().subVectors(b, a);
  let bd = o.bowDir ? o.bowDir.clone() : new THREE.Vector3(0, 1, 0).cross(dir);
  if (bd.lengthSq() < 1e-8) bd = new THREE.Vector3(1, 0, 0);
  bd.normalize();
  const pts: THREE.Vector3[] = [];
  const rad: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const f = i / seg;
    pts.push(a.clone().lerp(b, f).addScaledVector(bd, Math.sin(f * Math.PI) * bow));
    const ends = Math.pow(Math.abs(2 * f - 1), 2.2);          // 1 at both ends, 0 mid-shaft
    const base = r * THREE.MathUtils.lerp(1, taper, f);
    rad.push(Math.max(r * BONE_TIP_FLOOR, base * (1 - flare * 0.45 + flare * ends)));
  }
  return sweptTube(pts, rad, o.radial ?? 12, 0.05, o.jag != null ? { end: o.jag } : undefined);
}

/** A joint head / knuckle. Its real job is that no two bones in this figure ever meet at a visible
 *  seam — at 1m a butt joint between two tubes reads as two detached sticks. */
function knob(p: THREE.Vector3, r: number, s?: THREE.Vector3): THREE.BufferGeometry {
  // SphereGeometry, not Icosahedron: polyhedra are NON-INDEXED and `mergeGeometries` refuses a mix
  // (three's own error names it), and at 1m an icosphere's facets are visible anyway.
  const g = new THREE.SphereGeometry(r, 18, 13);
  if (s) g.scale(s.x, s.y, s.z);
  g.translate(p.x, p.y, p.z);
  return g;
}

/** THE POSE, as joints. Same staging as the authored figure — slumped against the wall on -Z facing
 *  +Z, head fallen forward, right arm out along the floor where the journal slipped from it, left
 *  hand in the lap, knees fallen apart with the heels on the rock. The difference is that these are
 *  a real CHAIN: every segment length is a plausible human bone and every joint is shared by the two
 *  bones that meet at it, which is what the 1m read was failing.
 *
 *  REACH IS A HARD LIMIT, and it is why `CAVE_BEAT_JOURNAL_FWD` moved. A seated figure's shoulder is
 *  at z ≈ -0.21; humerus 0.34 + radius 0.27 + hand 0.16 ≈ 0.77m of arm, and most of that budget is
 *  spent DROPPING 0.58m to the floor. The fingertips physically cannot pass z ≈ +0.25. */
const SK_SPINE: THREE.Vector3[] = [
  V(0, 0.175, -0.185),    // sacrum
  V(0, 0.285, -0.240),
  V(0, 0.400, -0.288),
  V(0, 0.510, -0.315),    // thoracic, flat against the rock
  V(0, 0.610, -0.325),
  V(0, 0.700, -0.313),
  V(0, 0.775, -0.284),    // cervical, coming forward as the head falls
];
const SK_SKULL = V(0, 0.850, -0.238);
// r2 → r3: ±0.165 is a 33cm shoulder span and the figure read as a slight teenager next to a 20cm
// skull. ±0.188 (38cm) is an adult's, and the arms hang clear of the ribcage instead of on it.
const SK_SHOULDER_R = V(0.188, 0.650, -0.214);
const SK_SHOULDER_L = V(-0.188, 0.650, -0.214);

// ── THE SKULL ────────────────────────────────────────────────────────────────────────────────────
// THE DEFECT THIS EXISTS TO KILL: the shipped skull's eye sockets are `CircleGeometry(0.032, 10)` —
// one zero-thickness face per socket. It works face-on and it VANISHES edge-on, on the single
// feature a player will put their own face against at 1m. Rule 7, on the worst possible mesh.
//
// THE FIX IS A REAL RECESS IN A SOLID, not a better disc. The cranium is a sphere whose vertices are
// DISPLACED — the orbits are pushed 2.6cm INTO the bone as a smooth elliptical dish with a raised
// margin, so the concavity is genuine geometry that shades correctly and holds its read from every
// angle including a hard graze. A near-black solid FRUSTUM is then sunk inside each dish (wide mouth
// at the dish, narrowing 2.8cm inward): it is a closed 3D body with real depth, so what the torch
// lights is a gradient down a tapering hole, which is exactly how an orbit reads in low light.
//
// TONE (the thing most likely to go wrong): NO TEETH. A dentition at 1m is a rictus grin and this is
// a survival game, not a horror game. The mandible is a smooth closed arch, the head has fallen
// FORWARD and to the reaching side like sleep, and the only strong feature is the brow.
interface SkullFeature {
  dir: THREE.Vector3;   // outward direction of the feature centre
  ax: number;           // angular half-width  (in tangent-dot units)
  ay: number;           // angular half-height
  amp: number;          // radial displacement, × R (negative = a dish INTO the bone)
  inner: number;        // where the falloff starts (0 = a point, 0.6 = a broad flat bottom)
}

/** The cranium: a sphere with its orbits, nasal aperture, temporal flats and brow displaced into it,
 *  then squashed to skull proportions. Returns geometry in the skull's own local frame (+Z is the
 *  face, origin at the cranial centre). */
function craniumGeometry(R: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 46, 34);
  // r2 → r3: the orbits were ax 0.40 / ay 0.31 and read as ALIEN goggles — a real orbit is about a
  // quarter of the face's width, and two big rounded ones in a tall cranium is the E.T. silhouette,
  // not a human skull. Smaller, deeper, and set a little higher.
  const ORBIT = (sx: number): SkullFeature => ({
    dir: V(sx * 0.42, 0.13, 0.92).normalize(), ax: 0.29, ay: 0.245, amp: -0.30, inner: 0.28,
  });
  const feats: SkullFeature[] = [
    ORBIT(-1), ORBIT(1),
    // Brow ridge — the one feature allowed to be strong. It is also what stops the orbit dishes from
    // reading as two dents in an egg.
    { dir: V(0, 0.34, 0.94).normalize(), ax: 0.90, ay: 0.19, amp: 0.095, inner: 0.30 },
    // …and a hollow just above it, so the ridge is a RIDGE and not a swelling of the whole forehead.
    { dir: V(0, 0.60, 0.80).normalize(), ax: 0.85, ay: 0.16, amp: -0.045, inner: 0.10 },
    // Nasal aperture — a real hole, not a shadow: deeper than the orbits and narrow.
    { dir: V(0, -0.16, 0.99).normalize(), ax: 0.145, ay: 0.28, amp: -0.34, inner: 0.10 },
    // Temporal flats (the sides of the head are FLAT — a sphere is the tell).
    { dir: V(-1, 0.10, -0.02).normalize(), ax: 0.66, ay: 0.50, amp: -0.13, inner: 0.0 },
    { dir: V(1, 0.10, -0.02).normalize(), ax: 0.66, ay: 0.50, amp: -0.13, inner: 0.0 },
    // The face narrows below the orbits toward the maxilla; the occiput swells out behind.
    { dir: V(0, -0.62, 0.78).normalize(), ax: 0.55, ay: 0.42, amp: -0.14, inner: 0.10 },
    { dir: V(0, -0.10, -1).normalize(), ax: 0.70, ay: 0.55, amp: 0.055, inner: 0.10 },
  ];
  // Orthonormal tangent frames, built once.
  const frames = feats.map((f) => {
    const t1 = new THREE.Vector3(0, 1, 0).cross(f.dir);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    return { t1, t2: new THREE.Vector3().crossVectors(f.dir, t1).normalize() };
  });
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    let rr = 1;
    for (let k = 0; k < feats.length; k++) {
      const f = feats[k];
      if (n.dot(f.dir) <= 0.02) continue;
      const a = n.dot(frames[k].t1) / f.ax, b = n.dot(frames[k].t2) / f.ay;
      const q = Math.sqrt(a * a + b * b);
      if (q >= 1) continue;
      rr += f.amp * (1 - THREE.MathUtils.smoothstep(q, f.inner, 1.0));
    }
    pos.setXYZ(i, n.x * R * rr, n.y * R * rr, n.z * R * rr);
  }
  // r2 → r3: was (0.90, 1.00, 1.09) on R=0.093 → a 19cm-TALL braincase, which is why the head read as
  // an egg / an alien. A human skull is ~15cm wide × 15cm tall × 19cm long: LOW and LONG.
  geo.scale(0.96, 0.86, 1.10);
  geo.computeVertexNormals();
  return geo;
}

/** Everything above the neck, in group space: cranium, orbit + nasal voids, maxilla, mandible. */
function addSkull(bone: THREE.BufferGeometry[], void_: THREE.BufferGeometry[]): void {
  const R = 0.093;
  // The head has FALLEN — pitched forward ~30° and rolled toward the reaching shoulder. Not a
  // symmetric, square, staged head: a head nobody is holding up any more.
  const M = new THREE.Matrix4()
    .makeTranslation(SK_SKULL.x, SK_SKULL.y, SK_SKULL.z)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.50, -0.11, -0.20, 'YXZ')));
  const put = (g: THREE.BufferGeometry, into: THREE.BufferGeometry[]): void => {
    g.applyMatrix4(M); into.push(g);
  };

  put(craniumGeometry(R), bone);

  // The orbit + nasal VOIDS: solid frusta sunk into the dishes. Wide mouth outward, narrowing in —
  // a tapering hole, never a facing disc.
  const sink = (dir: THREE.Vector3, rOut: number, rIn: number, depth: number, inset: number): void => {
    const g = new THREE.CylinderGeometry(rOut, rIn, depth, 22, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
    g.applyQuaternion(q);
    const c = dir.clone().multiplyScalar(R - inset - depth * 0.5);
    c.multiply(V(0.96, 0.86, 1.10));      // follow the cranium's own squash
    g.translate(c.x, c.y, c.z);
    put(g, void_);
  };
  for (const sx of [-1, 1] as const) sink(V(sx * 0.44, 0.10, 0.90).normalize(), 0.031, 0.012, 0.030, 0.013);
  sink(V(0, -0.16, 0.99).normalize(), 0.016, 0.006, 0.024, 0.010);

  // Maxilla — the shelf under the nose that gives the face a lower half. No teeth, by rule.
  {
    const g = new THREE.SphereGeometry(1, 20, 14);
    g.scale(0.052, 0.026, 0.030);
    g.translate(0, -0.062, 0.070);
    put(g, bone);
  }
  // Zygomatic arches — the cheekbone bridges. Small, but they are most of why a skull reads as a
  // skull in a raking light rather than as a dented ball.
  for (const sx of [-1, 1] as const) {
    put(shaft(
      V(sx * 0.052, -0.018, 0.062), V(sx * 0.070, 0.004, -0.050),
      0.0075, { bow: 0.010, bowDir: V(sx, 0, 0), flare: 0.35, radial: 9, seg: 5 },
    ), bone);
  }
  // Mandible — ONE continuous arch, condyle to chin to condyle, hung slightly slack. Smooth, closed,
  // toothless: the difference between "asleep" and "screaming" is entirely in this piece.
  {
    // r2 → r3, THE TONE FIX. At r2 the arch sat 2.5cm clear below the maxilla and its even curve
    // read, in the head-on frame, as a MOUTH LINE — a smile. It is now tucked up under the maxilla
    // (a closed jaw), narrower, and fatter in gauge so it reads as a jawBONE rather than a drawn
    // curve. Nothing about this figure may read as a grin.
    const pts = [
      V(-0.058, 0.012, -0.050), V(-0.064, -0.040, -0.028), V(-0.060, -0.072, 0.020),
      V(-0.036, -0.088, 0.062), V(0, -0.094, 0.079), V(0.036, -0.088, 0.062),
      V(0.060, -0.072, 0.020), V(0.064, -0.040, -0.028), V(0.058, 0.012, -0.050),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const P: THREE.Vector3[] = [];
    const rad: number[] = [];
    for (let i = 0; i <= 22; i++) {
      const f = i / 22;
      P.push(curve.getPoint(f));
      // Thickest at the chin, and the ends are CONDYLES (fat), never points.
      rad.push(Math.max(0.0100, 0.0125 + 0.0045 * Math.sin(f * Math.PI) + 0.0040 * Math.pow(Math.abs(2 * f - 1), 3)));
    }
    put(sweptTube(P, rad, 12, 0.05), bone);
  }
  // Cervical → cranium: the occipital knuckle, so the head is not a ball balanced on a stick.
  put(new THREE.SphereGeometry(0.030, 18, 13).translate(0, -0.072, -0.038), bone);
}

function makeCloseReadSkeleton(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'skeletonCloseRead';
  const bone: THREE.BufferGeometry[] = [];
  const void_: THREE.BufferGeometry[] = [];

  const spine = new THREE.CatmullRomCurve3(SK_SPINE);

  // ── VERTEBRAL COLUMN — 11 centra with spinous processes. A stack of plain cylinders reads as
  //    poker chips at 1m; the processes are what make it read as a SPINE.
  for (let i = 0; i < 11; i++) {
    const u = i / 10;
    const p = spine.getPoint(u);
    const t = spine.getTangent(u).normalize();
    const r = THREE.MathUtils.lerp(0.033, 0.021, u);          // lumbar → cervical
    bone.push(shaft(p.clone().addScaledVector(t, -0.021), p.clone().addScaledVector(t, 0.021), r, {
      flare: 0.55, seg: 3, radial: 14,
    }));
    if (u < 0.94) {
      const back = V(0, -0.30, -1).normalize();               // processes point back and DOWN
      bone.push(shaft(
        p.clone().addScaledVector(back, r * 0.7),
        p.clone().addScaledVector(back, r * 0.7 + 0.055),
        0.011, { taper: 0.75, flare: 0.15, seg: 3, radial: 8 },
      ));
    }
  }

  // ── RIBCAGE — 6 pairs, each a real hoop from the spine out to the sternum line. (The shipped
  //    figure's half-tori lie in the sagittal plane and read as a coil spring; these lie where ribs
  //    lie.) The lower two pairs are FLOATING ribs and stop short, which is both true and what keeps
  //    the front of the cage from reading as a barrel.
  const sternumEnds: THREE.Vector3[] = [];
  for (let k = 0; k < 6; k++) {
    const u = 0.36 + (k / 5) * 0.50;
    const b0 = spine.getPoint(u);
    const s = 0.68 + 0.32 * Math.sin((Math.PI * (k + 0.6)) / 6.2);   // widest at the middle ribs
    const floating = k >= 4;
    for (const sx of [-1, 1] as const) {
      const arc = [
        V(sx * 0.028, 0.0, 0.020),
        V(sx * 0.112 * s, -0.022, 0.075 * s),
        V(sx * 0.180 * s, -0.055, 0.195 * s),
        V(sx * 0.160 * s, -0.098, 0.300 * s),
        V(sx * 0.092 * s, -0.132, 0.352 * s),
        V(sx * 0.036 * s, -0.150, 0.372 * s),
      ].map((q) => q.add(b0));
      const use = floating ? arc.slice(0, 4) : arc;
      const pts: THREE.Vector3[] = [];
      const rad: number[] = [];
      const curve = new THREE.CatmullRomCurve3(use);
      const N = 11;
      for (let i = 0; i <= N; i++) {
        const f = i / N;
        pts.push(curve.getPoint(f));
        // Never below the floor, and slightly fatter at the spine end (the rib head).
        rad.push(Math.max(0.0105 * BONE_TIP_FLOOR, 0.0135 - 0.0035 * f));
      }
      bone.push(sweptTube(pts, rad, 10, 0.06));
      if (!floating) sternumEnds.push(use[use.length - 1].clone());
    }
  }
  // Sternum — a flat plate down the front midline tying the top rib ends together.
  {
    const top = sternumEnds[0].clone().lerp(sternumEnds[1], 0.5);
    const bot = sternumEnds[sternumEnds.length - 2].clone().lerp(sternumEnds[sternumEnds.length - 1], 0.5);
    const st = shaft(top, bot, 0.026, { flare: 0.2, radial: 12 });
    st.scale(1, 1, 0.42);                                     // a PLATE, not a rod — but 2cm deep
    bone.push(st);
  }

  // ── SHOULDER GIRDLE — clavicles + scapulae. These exist entirely so the arms are ATTACHED.
  for (const sh of [SK_SHOULDER_L, SK_SHOULDER_R]) {
    const sx = Math.sign(sh.x);
    bone.push(shaft(V(0, 0.640, -0.150), sh, 0.010, { bow: 0.022, bowDir: V(0, 0, 1), flare: 0.5, radial: 10 }));
    bone.push(knob(V(sx * 0.135, 0.600, -0.290), 0.075, V(1.0, 1.15, 0.34)));   // scapula blade
    bone.push(knob(sh, 0.030, V(1.0, 0.85, 0.9)));                              // the joint head
  }

  // ── PELVIS — two iliac blades + the seat. Real thickness (the blades are 6cm through), not a box.
  for (const sx of [-1, 1] as const) {
    bone.push(knob(V(sx * 0.125, 0.215, -0.190), 0.098, V(0.30, 1.05, 0.92)));
    bone.push(shaft(V(sx * 0.075, 0.150, -0.230), V(sx * 0.118, 0.140, -0.120), 0.024, { flare: 0.3, radial: 10 }));
  }

  // ── ARMS. Chains, not props: shoulder → elbow → wrist → the hand, each joint shared.
  const armChain = (
    sh: THREE.Vector3, el: THREE.Vector3, wr: THREE.Vector3, tip: THREE.Vector3, spread: number,
  ): void => {
    const sx = Math.sign(sh.x);
    bone.push(shaft(sh, el, 0.0205, { bow: 0.012, flare: 0.45, radial: 12 }));
    bone.push(knob(el, 0.026, V(1, 0.9, 1)));
    // Radius + ulna, two shafts side by side — one tube for a forearm is the giveaway at 1m.
    const off = new THREE.Vector3().subVectors(wr, el).cross(V(0, 1, 0)).normalize().multiplyScalar(0.011);
    bone.push(shaft(el.clone().add(off), wr.clone().addScaledVector(off, 0.55), 0.0135, { flare: 0.5, radial: 10 }));
    bone.push(shaft(el.clone().sub(off), wr.clone().addScaledVector(off, -0.55), 0.0125, { flare: 0.5, radial: 10 }));
    bone.push(knob(wr, 0.021, V(1, 0.72, 1)));
    // The hand: a carpal knuckle and four metacarpal/finger rays fanning to the fingertips.
    const dir = new THREE.Vector3().subVectors(tip, wr);
    const lat = new THREE.Vector3().crossVectors(dir, V(0, 1, 0)).normalize();
    for (let f = 0; f < 4; f++) {
      const t = (f / 3 - 0.5) * spread;
      const end = tip.clone().addScaledVector(lat, t).addScaledVector(dir, -Math.abs(t) * 0.9);
      const mid = wr.clone().addScaledVector(dir, 0.45).addScaledVector(lat, t * 0.45);
      bone.push(shaft(wr, mid, 0.0072, { flare: 0.3, radial: 8, seg: 3 }));
      bone.push(shaft(mid, end, 0.0060, { taper: 0.85, flare: 0.35, radial: 8, seg: 4 }));
    }
    // The thumb, off to the medial side — the read that says "hand", not "fork".
    bone.push(shaft(
      wr.clone().addScaledVector(lat, sx * 0.014),
      wr.clone().addScaledVector(dir, 0.42).addScaledVector(lat, sx * 0.055).add(V(0, -0.005, 0)),
      0.0068, { flare: 0.3, radial: 8, seg: 4 },
    ));
  };
  // RIGHT — out along the floor at full stretch, fingers open, where the book slipped from it.
  armChain(SK_SHOULDER_R, V(0.268, 0.400, -0.005), V(0.234, 0.160, 0.120), V(0.216, 0.058, 0.252), 0.085);
  // LEFT — folded into the lap.
  armChain(SK_SHOULDER_L, V(-0.285, 0.375, -0.110), V(-0.130, 0.290, 0.070), V(-0.045, 0.235, 0.155), 0.070);

  // ── LEGS. Knees fallen apart, heels on the rock. (The shipped figure's femurs pitch BACKWARD and
  //    put every leg bone below y=0 — buried under the floor, which is why the wreck skeleton reads
  //    as having no legs at all.)
  for (const sx of [-1, 1] as const) {
    // r2 → r3: the knees were at ±0.30 and the legs read FROG-like — splayed wide and thin. Pulled
    // in, and both leg bones given real gauge (a femur is the thickest bone in the body; at r2 it
    // was barely fatter than the forearm).
    // ASYMMETRIC on purpose (r3 → r4). With both knees at the same splay the RIGHT knee stood
    // exactly on the line between the eye and the reaching arm at the approach angle, and hid the
    // one gesture the whole tableau is about. The right leg is drawn in and the arm passes OUTSIDE
    // it; a body that fell asleep against a wall is not symmetrical anyway.
    const inner = sx > 0 ? 0.80 : 1.0;
    const hip = V(sx * 0.115, 0.160, -0.160);
    const knee = V(sx * 0.258 * inner, 0.235, 0.190);
    const ankle = V(sx * 0.163 * inner, 0.078, 0.470 + (sx > 0 ? 0.02 : 0));
    bone.push(knob(hip, 0.032));
    bone.push(shaft(hip, knee, 0.0335, { bow: 0.020, bowDir: V(0, 1, 0), flare: 0.5, radial: 14 }));
    bone.push(knob(knee, 0.038, V(1, 0.88, 1)));
    // Tibia + the thinner fibula beside it.
    bone.push(shaft(knee, ankle, 0.0285, { flare: 0.5, radial: 12 }));
    bone.push(shaft(
      knee.clone().add(V(sx * 0.030, -0.014, 0)), ankle.clone().add(V(sx * 0.022, 0, 0)),
      0.0125, { flare: 0.4, radial: 10 },
    ));
    bone.push(knob(ankle, 0.029, V(1, 0.85, 1)));
    // The foot, fallen outward the way a dead foot does. A tarsal mass FIRST — at r2 the foot was
    // three bare rays off the ankle and read as a bird's claw.
    const heel = V(sx * 0.178 * inner, 0.052, 0.508 + (sx > 0 ? 0.02 : 0));
    bone.push(knob(heel, 0.036, V(0.62, 0.55, 0.95)));
    for (let t = 0; t < 3; t++) {
      const q = (t / 2 - 0.5);
      bone.push(shaft(
        heel, V(sx * (0.232 + q * 0.052) * inner, 0.043, 0.578 + q * 0.030 + (sx > 0 ? 0.02 : 0)),
        0.0088, { taper: 0.82, flare: 0.3, radial: 8, seg: 4 },
      ));
    }
  }

  // ── THE ONE FRACTURE. A rib that has come away and lies on the rock beside the body: decay and
  //    time, not violence (tone). It is also the tableau's cross-section evidence — a `jag` snap end
  //    shows a solid splintered break instead of a capped pill (rule 7).
  const fallenA = V(0.300, 0.030, 0.145);
  const fallenB = V(0.455, 0.026, -0.115);
  bone.push(shaft(fallenB, fallenA, 0.0155, { bow: 0.045, bowDir: V(0, 0.15, 1), flare: 0.35, radial: 12, jag: 2207 }));

  addSkull(bone, void_);

  const merged = mergeGeometries(bone, false);
  const mesh = new THREE.Mesh(merged, _boneMatCave);
  mesh.castShadow = true; mesh.receiveShadow = true;
  // Declared anchors for the rig framings (the `wallShelf` precedent): a diagnostic that has to GUESS
  // where the skull is photographs a stalagmite and grades it green.
  mesh.userData.boneFracture = { x: fallenA.x, y: fallenA.y, z: fallenA.z, r: 0.0155 };
  g.add(mesh);
  if (void_.length) {
    const vm = new THREE.Mesh(mergeGeometries(void_, false), _socketMatCave);
    vm.castShadow = false; vm.receiveShadow = true;
    g.add(vm);
  }
  const anchor = new THREE.Object3D();
  anchor.position.copy(SK_SKULL);
  anchor.userData.skullAnchor = true;
  g.add(anchor);
  return g;
}
