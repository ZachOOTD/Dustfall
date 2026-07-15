// bone_field scatter bits — cheap, half-buried leviathan-bone DECORATIONS
// strewn across the titan-graveyard biome. These are the biome's POP alongside
// the pale ground: individual skulls, rib arches, spine runs, and long-bones /
// tusks poking out of the sand, dense enough to read as "a graveyard of dead
// titans" the moment you enter.
//
// These are decoration-only (NO colliders — the established scatter-rock rule;
// the walkable-into hero silhouettes are the collidered placeRibcage props the
// chunk mixes in alongside these). They all share ONE module bone material so a
// chunk can MERGE them into a single draw call (mergeStaticByMaterial). All
// primitives are inherently thick (cylinders / tori / icosahedra) per rule 7.
//
// The shared material samples cracks/bleach in WORLD space, so every bit gets
// free per-position variation and (post-merge, identity model matrix) the read
// is unchanged.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import { createBoneMaterial } from './boneMaterial.ts';

// Shared across ALL bone-scatter bits (one program, one draw group per chunk
// after merge). Warm-but-bleached bone; strong age-bleach so the tops read
// sun-whitened. NEVER disposed on chunk unload (the _treeMat shared-material
// rule — merged bit geometry is disposed via the noCollider tag).
const _boneMat = createBoneMaterial(0xdcd8cf, {
  crackDensity: 1.15,
  marrowHint: 0.3,    // faint yellow-brown mineral stain
  ageBleach: 0.7,     // sun-weathered tops (dialled back from stark-white)
});
// The graveyard's POP: under Dustfall's permanently WARM "long-storm" sun a plain
// ivory material collapses to tan (color × warm light) and blends into the sand.
// A subtle COOL emissive self-illuminates the bone so it reads as BONE regardless
// of the light — what makes the field pop + separates the bones from the warm
// dunes. Tuned GREYER + less-cool + less-intense than before (reviewer: "bones
// too white") — a near-neutral grey fill, not a blue-white lamp.
_boneMat.emissive = new THREE.Color(0x545a60);
_boneMat.emissiveIntensity = 0.55;
const _socketMat = new THREE.MeshLambertMaterial({ color: 0x140f09, flatShading: true });

export type BoneBitKind = 'skull' | 'ribarch' | 'spine' | 'longbone';

/** All the bone-bit kinds a scatter descriptor can pick (fixed order → a
 *  descriptor's kindRoll maps stably). */
export const BONE_BIT_KINDS: readonly BoneBitKind[] = ['skull', 'ribarch', 'spine', 'longbone'];

function bone(geo: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geo, _boneMat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A titan SKULL — elongated icosahedron with recessed dark eye sockets + a
// nasal void. Reads as a skull, not a rock, from a glance.
function buildSkull(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const r = 0.7 + rand() * 0.5;                     // ~0.7-1.2m radius base
  const cranium = bone(new THREE.IcosahedronGeometry(r, 1));
  cranium.scale.set(1.35, 0.9, 0.95);               // snout elongated along +X
  cranium.position.y = r * 0.75;
  g.add(cranium);
  // Snout / muzzle — a tapered cone extending the face.
  const snout = bone(new THREE.ConeGeometry(r * 0.55, r * 1.1, 7));
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(r * 1.25, r * 0.7, 0);
  g.add(snout);
  // Recessed dark eye sockets (read as hollow eyes) — the "skull" tell.
  for (const dz of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.CircleGeometry(r * 0.28, 10), _socketMat);
    socket.position.set(r * 0.62, r * 0.95, dz * r * 0.5);
    socket.rotation.y = dz * 0.5;
    socket.rotation.x = -0.15;
    g.add(socket);
  }
  g.rotation.y = rand() * Math.PI * 2;
  g.rotation.z = (rand() - 0.5) * 0.3;              // fallen at an angle
  return g;
}

// A run of RIB arches breaching the sand — a partial ribcage of a huge beast,
// spine long gone. The most evocative "titan bones" read.
function buildRibArch(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const n = 4 + Math.floor(rand() * 3);            // 4-6 ribs
  const spacing = 0.55 + rand() * 0.25;
  const thick = 0.09 + rand() * 0.05;
  const baseR = 0.9 + rand() * 0.7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;                    // -0.5..0.5 along the run
    const ribR = baseR * (1 - Math.abs(t) * 0.55);  // taper toward the ends
    const rib = bone(new THREE.TorusGeometry(ribR, thick, 5, 14, Math.PI));
    rib.rotation.y = Math.PI / 2;                    // arch plane spans across the run
    rib.rotation.z = (rand() - 0.5) * 0.12;          // each rib slightly askew
    rib.position.set(t * n * spacing, 0, 0);
    g.add(rib);
  }
  g.rotation.y = rand() * Math.PI * 2;
  return g;
}

// A segmented SPINE — a curving row of vertebra drums with transverse-process
// nubs, partly buried so only the crest of the column shows.
function buildSpine(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const n = 5 + Math.floor(rand() * 4);            // 5-8 vertebrae
  const seg = 0.42 + rand() * 0.18;
  const r = 0.22 + rand() * 0.12;
  const curve = (rand() - 0.5) * 0.5;              // gentle S along the run
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2;
    const drum = bone(new THREE.CylinderGeometry(r, r * 0.92, seg * 0.85, 8));
    drum.rotation.z = Math.PI / 2;                   // axis along +X
    const yy = -Math.abs(t) * Math.abs(curve) * 0.12;
    drum.position.set(t * seg, r + yy, t * curve * 0.12);
    g.add(drum);
    // A dorsal spinous process (a small fin poking up).
    const proc = bone(new THREE.ConeGeometry(r * 0.42, r * 1.3, 5));
    proc.position.set(t * seg, r * 2.0 + yy, t * curve * 0.12);
    g.add(proc);
  }
  g.rotation.y = rand() * Math.PI * 2;
  return g;
}

// A single massive LONG-BONE / tusk arcing out of the sand — a femur or a
// leviathan tusk, with bulbous epiphysis ends. A clean, strong silhouette.
function buildLongBone(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const len = 2.2 + rand() * 1.8;
  const r = 0.14 + rand() * 0.08;
  const shaft = bone(new THREE.CylinderGeometry(r, r * 1.05, len, 8));
  shaft.rotation.z = Math.PI / 2;                    // along +X
  shaft.rotation.x = 0;
  const arc = (rand() - 0.5) * 0.4;
  shaft.rotation.y = arc;
  shaft.position.y = len * 0.18;
  g.add(shaft);
  // Bulbous ends (knuckle / socket heads).
  for (const s of [-1, 1]) {
    const head = bone(new THREE.IcosahedronGeometry(r * 1.9, 0));
    head.position.set(s * len * 0.5 * Math.cos(arc), len * 0.18, -s * len * 0.5 * Math.sin(arc));
    head.scale.set(1.1, 0.85, 1.0);
    g.add(head);
  }
  g.rotation.y = rand() * Math.PI * 2;
  g.rotation.z = (rand() - 0.5) * 0.25;
  return g;
}

/** Build a half-buried bone-scatter bit. The caller positions the returned
 *  group at the world spot, applies the descriptor scale, and sinks it partly
 *  into the sand. Meshes share the module bone material (tag geometry chunkGeo,
 *  NOT chunkMat, or merge the group). */
export function buildBoneBit(kind: BoneBitKind, rand: Rng): THREE.Group {
  switch (kind) {
    case 'skull': return buildSkull(rand);
    case 'ribarch': return buildRibArch(rand);
    case 'spine': return buildSpine(rand);
    case 'longbone': return buildLongBone(rand);
  }
}
