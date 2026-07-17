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
import { createBoneMaterial, registerBoneEmissive } from './boneMaterial.ts';

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
// Registered (not set directly) so the emissive SCALES WITH THE SUN: it exists to
// cancel the sun's warmth, so it fades to 0 below the horizon instead of glowing
// through the night. Day look unchanged — 0.55 is the full-daylight value.
registerBoneEmissive(_boneMat, 0x545a60, 0.55);

/** The shared bone-scatter material. Exported for the chunk manager's scatter
 *  ribcages, which adopt it so the whole graveyard (bits + ribcages) shares ONE
 *  look and ONE registered, sun-driven emissive. NEVER dispose it (the _treeMat
 *  shared-material rule) — tag adopting meshes `chunkGeo` but NOT `chunkMat`. */
export const boneScatterMaterial = _boneMat;

export type BoneBitKind = 'ribarch' | 'spine' | 'longbone';

/** All the bone-bit kinds a scatter descriptor can pick (fixed order → a
 *  descriptor's kindRoll maps stably). The old `skull` bit (a scaled icosahedron
 *  cranium) was REMOVED per the reviewer — it read as a featureless dome-ish blob
 *  in the field; only the strong reads (rib arches, spines, long-bones) remain. */
export const BONE_BIT_KINDS: readonly BoneBitKind[] = ['ribarch', 'spine', 'longbone'];

function bone(geo: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geo, _boneMat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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
    case 'ribarch': return buildRibArch(rand);
    case 'spine': return buildSpine(rand);
    case 'longbone': return buildLongBone(rand);
  }
}
