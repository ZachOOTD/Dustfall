// Skeleton primitive (Session W). Hand-coded composite positioned to read
// as "slumped against the back wall, died writing." All bones are simple
// THREE.js primitives — no rigging, no animation. The group origin is at
// the floor between the skeleton's feet so the caller positions it relative
// to the floor of the shelter.
//
// Orientation convention: the skeleton faces +Z (forward, away from back
// wall). Back wall sits behind on -Z; the right hand extends along +Z
// toward where the journal lies.

import * as THREE from 'three';
import { createBoneMaterial } from './boneMaterial.ts';

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

export function makeSkeleton(): THREE.Group {
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
  spineBase.add(skull);
  // Eye sockets — dark RECESSED discs (read as hollow eyes at a glance, not protruding
  // balls). Brow ridge above + a nasal void below flip the read from "ball" to "skull".
  for (const dx of [-0.043, 0.043]) {
    const socket = new THREE.Mesh(new THREE.CircleGeometry(0.032, 10), _socketMat);
    socket.position.set(dx, 0.655, 0.088);
    socket.rotation.x = -0.12;
    spineBase.add(socket);
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
