// bone_field scatter — the titan-graveyard's strewn bone PROPS (SEPARATE from the
// colossal hero ribcage). A VOCABULARY of real bone forms half-buried across the
// biome: cracked snapped long-bones, rib-fans breaching the sand, vertebral chains,
// loose vertebra chunks, and small partial carcasses — dense enough to read as "a
// graveyard of dead titans" the moment you enter.
//
// This is the overhaul of the OLD scatter (2026-07-17): the old bits were a lighter
// ivory material + rounded TORUS "ribarch" rings lying flat in the sand — visibly
// outdated next to the redesigned hero ribcage. Now the scatter REUSES the hero's own
// vocabulary:
//   • the hero's swept-tube fracture pipeline (`sweptTube` + jagged `jag` snap caps
//     from giantRibcage.ts) → every long-bone / rib / spine-stub ends in a real
//     splintered bone cross-section, never a rounded pill or a flat ring; and
//   • the hero's EXACT material object (`heroBoneMaterial`) → the whole graveyard,
//     hero + scatter, shares ONE weathered-grey bone treatment with ONE registered,
//     SUN-DRIVEN cool emissive. No new material, no new registry entry: the scatter
//     inherits the hero's daylight fade, so it does NOT glow at night (the bone_field
//     night-glow bug that bit the hero + the worm — fixed here at the source, not
//     with a hand-tuned constant).
//
// All primitives are closed SOLIDS with real thickness (swept capped tubes /
// cylinders / cones / icosahedra) per rule 7 — snapped ends show a solid jagged
// cross-section; nothing is a paper shell. The material samples cracks/bleach/grime
// in WORLD space, so every bit gets free per-position variation and (post-merge,
// identity model matrix) the read is unchanged.
//
// Collision (rule 9): these bits are DECORATION-ONLY, no colliders — the established
// scatter-rock rule. They are small, LOW, and half-buried (the caller sinks the
// bottom below the sand), so a player steps over / walks between them; nothing here
// is a player-blocking wall. The biome's substantial, walk-into bone silhouettes are
// the COLLIDERED placeRibcage props (chunkManager) + the colossal hero ribcage, which
// carry their own paired colliders. Keeping the strewn bits no-collide is deliberate
// and consistent with how the biome already tags `noCollider`.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import { sweptTube, heroBoneMaterial, type JagSpec } from './giantRibcage.ts';

/** The shared bone material — the HERO ribcage's exact object. Exported for the
 *  chunk manager's scatter ribcages, which adopt it so the whole graveyard (bits +
 *  ribcages + hero) shares ONE look and ONE registered, sun-driven emissive. NEVER
 *  dispose it (the _treeMat shared-material rule) — tag adopting meshes `chunkGeo`
 *  but NOT `chunkMat`. */
export const boneScatterMaterial = heroBoneMaterial;

export type BoneBitKind = 'longbone' | 'ribfan' | 'spine' | 'vertebra' | 'carcass';

/** All the bone-bit kinds a scatter descriptor can pick (fixed order → a descriptor's
 *  kindRoll maps stably). Five distinct reads so repeats never look like copies: a
 *  lone cracked long-bone, a fan of ribs breaching the sand, a vertebral chain, a
 *  loose vertebra chunk, and a small partial carcass. */
export const BONE_BIT_KINDS: readonly BoneBitKind[] =
  ['longbone', 'ribfan', 'spine', 'vertebra', 'carcass'];

function bone(geo: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geo, heroBoneMaterial);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A deterministic integer seed drawn from the bit's own rng stream — feeds the
 *  jagged fracture caps (which want an integer, not the [0,1) float). Each bit has an
 *  independent seed stream (makeRng(bd.seed)), so draw COUNT here is free — it can't
 *  shift another bit or the chunk descriptor digest (procgen-seed-stability). */
const iseed = (rand: Rng): number => Math.floor(rand() * 0x7fffffff);

/** A single rib as a swept SOLID tube arcing up out of the sand: rooted at (bx,bz)
 *  at y=0, rising to `height`, curling `curveOut` along (dirX,dirZ), tapering r0→r1.
 *  `rake` skews the tip along +X (fore/aft jitter so a fan isn't a picket fence). A
 *  `jag.end` snaps the free tip into a real splintered break; the rooted base is left
 *  domed (it buries in the sand). Reused by ribfan + carcass. */
function ribArc(
  bx: number, bz: number, dirX: number, dirZ: number,
  height: number, curveOut: number, r0: number, r1: number,
  seg: number, rake: number, jag?: JagSpec,
): THREE.BufferGeometry {
  const SPAN = Math.PI * 0.6;                 // ~108° of arc — a rib that curls over
  const norm = Math.sin(SPAN);
  const pts: THREE.Vector3[] = [];
  const rad: number[] = [];
  for (let k = 0; k <= seg; k++) {
    const f = k / seg;
    const ang = f * SPAN;
    const rise = height * (Math.sin(ang) / norm);
    const out = curveOut * (1 - Math.cos(ang));
    pts.push(new THREE.Vector3(bx + dirX * out + rake * f, rise, bz + dirZ * out));
    rad.push(THREE.MathUtils.lerp(r0, r1, Math.pow(f, 0.7)));
  }
  return sweptTube(pts, rad, 8, 0.07, jag);
}

// ── A single massive cracked LONG-BONE (femur / leviathan tusk) arcing out of the
//    sand: a gently bowed solid shaft, snapped (jagged fracture) at the free end and
//    ~45% of the time at BOTH ends (a shard); a knobby EPIPHYSIS cluster at any intact
//    end (the knuckle heads a real long bone flares into). A clean, strong silhouette
//    that reads unmistakably as a broken bone, not a sausage. ──
function buildLongBone(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const len = 2.4 + rand() * 1.8;
  const r = 0.16 + rand() * 0.08;
  const bow = (rand() - 0.5) * 0.9;             // lateral bow
  const rise = 0.3 + rand() * 0.55;             // one end lifts clear of the sand
  const seg = 9;
  const pts: THREE.Vector3[] = [];
  const rad: number[] = [];
  for (let k = 0; k <= seg; k++) {
    const f = k / seg;
    pts.push(new THREE.Vector3(
      (f - 0.5) * len,
      Math.sin(f * Math.PI) * rise * 0.5 + f * rise * 0.4,
      Math.sin(f * Math.PI) * bow,
    ));
    // Near-uniform shaft, a touch fatter at the ends so the snap face + knuckle attach
    // sit on a FULL cross-section (never a taper-to-needle).
    rad.push(r * (0.88 + 0.12 * (1 - Math.sin(f * Math.PI))));
  }
  const bothSnap = rand() < 0.45;
  const sStart = iseed(rand), sEnd = iseed(rand);
  g.add(bone(sweptTube(pts, rad, 9, 0.08, {
    start: bothSnap ? sStart : null,
    end: sEnd,
  })));
  // Epiphysis knuckle cluster at the intact end (pts[0]).
  if (!bothSnap) {
    const end = pts[0];
    const kn = 2 + Math.floor(rand() * 2);
    for (let q = 0; q < kn; q++) {
      const head = bone(new THREE.IcosahedronGeometry(r * (1.4 + rand() * 0.55), 0));
      head.position.set(
        end.x + (rand() - 0.5) * r * 1.3,
        end.y + (rand() - 0.5) * r * 1.1,
        end.z + (rand() - 0.5) * r * 1.3,
      );
      head.scale.set(1.15, 0.82, 1.0);
      g.add(head);
    }
  }
  g.rotation.z = (rand() - 0.5) * 0.25;
  return g;
}

// ── A FAN of individual ribs breaching the sand — a partial ribcage of a huge beast,
//    the spine long gone. This REPLACES the old flat torus "ribarch" ring: each rib is
//    now a real swept solid tube arcing up + curling over, tapering to a snapped or
//    tapered tip, laid in a slightly raked row. The strongest "titan bones" read. ──
function buildRibFan(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const n = 4 + Math.floor(rand() * 3);          // 4-6 ribs
  const spacing = 0.42 + rand() * 0.24;
  const baseH = 1.3 + rand() * 0.95;
  const side = rand() < 0.5 ? 1 : -1;            // which way the fan curls
  const curveOut = (0.55 + rand() * 0.5) * side;
  const r0 = 0.11 + rand() * 0.05;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;                  // -0.5..0.5 along the run
    const h = baseH * (1 - Math.abs(t) * 0.42);   // taper toward the ends
    const snapped = rand() < 0.62;                // most ribs broke off up top
    const jseed = iseed(rand);
    const rake = (rand() - 0.5) * 0.5;
    g.add(bone(ribArc(
      t * n * spacing, 0, 0, 1, h,
      curveOut * (0.85 + rand() * 0.3), r0, r0 * 0.4, 8, rake,
      snapped ? { end: jseed } : undefined,
    )));
  }
  g.rotation.z = (rand() - 0.5) * 0.12;
  return g;
}

// ── A segmented SPINE — a curving row of vertebra drums with a girdle ridge, dorsal
//    neural spines poking up, and transverse-process nubs; partly buried so only the
//    crest of the column shows. Decay: some vertebrae lose their neural spine / a
//    process (a weathered, not pristine, column). ──
function buildSpine(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const n = 5 + Math.floor(rand() * 4);          // 5-8 vertebrae
  const seg = 0.42 + rand() * 0.18;
  const r = 0.2 + rand() * 0.12;
  const curve = (rand() - 0.5) * 0.5;            // gentle S along the run
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2;
    const yy = -Math.abs(t) * Math.abs(curve) * 0.12;
    const cx = t * seg, cy = r + yy, cz = t * curve * 0.12;
    // Vertebra drum (short cylinder, axis along +X).
    const drum = bone(new THREE.CylinderGeometry(r * 0.86, r * 0.9, seg * 0.82, 9));
    drum.rotation.z = Math.PI / 2;
    drum.position.set(cx, cy, cz);
    g.add(drum);
    // Girdle ridge girdling the drum.
    const ring = bone(new THREE.TorusGeometry(r * 0.98, r * 0.22, 6, 12));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(cx, cy, cz);
    g.add(ring);
    // Dorsal neural spine (a blade poking up) — skipped on a decayed vertebra.
    if (rand() > 0.25) {
      const proc = bone(new THREE.ConeGeometry(r * 0.4, r * (1.4 + rand() * 0.6), 5));
      proc.position.set(cx, cy + r * 1.1, cz);
      proc.rotation.x = (rand() - 0.5) * 0.3;
      g.add(proc);
    }
    // Transverse processes (two small lateral nubs).
    for (const s of [-1, 1] as const) {
      if (rand() < 0.35) continue;
      const tp = bone(new THREE.ConeGeometry(r * 0.28, r * 0.9, 4));
      tp.rotation.z = s * Math.PI * 0.42;
      tp.position.set(cx, cy + r * 0.2, cz + s * r * 0.7);
      g.add(tp);
    }
  }
  return g;
}

// ── A loose VERTEBRA chunk (1-2) half-sunk and tumbled — a single fat centrum drum
//    with its girdle ridge, a neural-spine blade, and transverse processes, lying at
//    a settled tumble angle. Reads as one big real bone piece, not a ring. ──
function buildVertebra(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const cnt = 1 + Math.floor(rand() * 2);        // 1-2 chunks
  let ox = 0;
  for (let c = 0; c < cnt; c++) {
    const vg = new THREE.Group();
    const r = 0.5 + rand() * 0.42;
    // CENTRUM — a spool: a waisted drum with FLARED endplate rings at each end (the
    // hourglass profile that reads unmistakably as a vertebra, not a pebble).
    const drum = bone(new THREE.CylinderGeometry(r * 0.78, r * 0.78, r * 1.5, 12));
    drum.rotation.z = Math.PI / 2;
    vg.add(drum);
    for (const s of [-1, 1] as const) {
      const plate = bone(new THREE.TorusGeometry(r * 0.82, r * 0.22, 8, 14));
      plate.rotation.y = Math.PI / 2;
      plate.position.x = s * r * 0.72;
      vg.add(plate);
    }
    // Girdle ridge at the waist.
    const ring = bone(new THREE.TorusGeometry(r * 0.86, r * 0.2, 8, 14));
    ring.rotation.y = Math.PI / 2;
    vg.add(ring);
    // Tall dorsal neural spine — a clear bony fin, the vertebra's read at a glance.
    const blade = bone(new THREE.ConeGeometry(r * 0.44, r * 2.5, 6));
    blade.position.y = r * 1.55;
    blade.rotation.x = (rand() - 0.5) * 0.2;
    vg.add(blade);
    for (const s of [-1, 1] as const) {
      const tp = bone(new THREE.ConeGeometry(r * 0.3, r * 1.4, 5));
      tp.rotation.z = s * Math.PI * 0.42;
      tp.position.set(0, r * 0.35, s * r * 0.95);
      vg.add(tp);
    }
    // Settled tumble — a fallen vertebra lists, but not enough to bury the fin.
    vg.position.set(ox, 0, (rand() - 0.5) * r);
    vg.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.45);
    g.add(vg);
    ox += r * 1.5 + rand() * 0.6;
  }
  return g;
}

// ── A small partial CARCASS — a spine stub with rib pairs arcing up from each side:
//    reads as a whole dead creature half-buried in the sand, ribcage opened to the
//    sky. Some ribs missing (decay gaps), most snapped. The strongest "there are
//    SKELETONS out here, not just loose bones" read. ──
function buildCarcass(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const npair = 3 + Math.floor(rand() * 3);      // 3-5 rib pairs
  const spacing = 0.55 + rand() * 0.25;
  const spineR = 0.16 + rand() * 0.07;
  const spineLen = npair * spacing;
  const arcAmt = 0.2 + rand() * 0.4;             // the spine bows up mid-run
  // Spine stub — a low swept solid tube along +X, gently arced, near the sand, snapped
  // at one end (the head/tail long gone).
  const sseg = npair * 2;
  const spts: THREE.Vector3[] = [];
  const srad: number[] = [];
  const yAt = (f: number): number => 0.2 + Math.sin(f * Math.PI) * arcAmt;
  for (let k = 0; k <= sseg; k++) {
    const f = k / sseg;
    spts.push(new THREE.Vector3((f - 0.5) * spineLen, yAt(f), 0));
    srad.push(spineR * (0.8 + 0.2 * Math.sin(f * Math.PI)));
  }
  g.add(bone(sweptTube(spts, srad, 8, 0.07, { end: iseed(rand) })));
  const ribR = spineR * 0.78;
  const ribH = 0.9 + rand() * 0.7;
  const curveOut = 0.5 + rand() * 0.4;
  for (let i = 0; i < npair; i++) {
    const t = (i + 0.5) / npair - 0.5;
    const bx = t * spineLen;
    const by = yAt(t + 0.5);                      // rib base rides the arced spine
    const h = ribH * (1 - Math.abs(t) * 0.4);
    for (const s of [-1, 1] as const) {
      if (rand() < 0.2) continue;                 // a decayed gap
      const snapped = rand() < 0.6;
      const jseed = iseed(rand);
      const mesh = bone(ribArc(
        bx, 0, 0, s, h, curveOut, ribR, ribR * 0.42, 7, (rand() - 0.5) * 0.3,
        snapped ? { end: jseed } : undefined,
      ));
      mesh.position.y = by;
      g.add(mesh);
    }
  }
  g.rotation.z = (rand() - 0.5) * 0.15;           // a slight list (a settled carcass)
  return g;
}

/** Build a half-buried bone-scatter bit. The caller positions the returned group at
 *  the world spot, applies the descriptor scale + a yaw about Y, and seats it by its
 *  real bbox so the bottom sinks below the sand (no floaters). Meshes share the module
 *  bone material (tag geometry chunkGeo, NOT chunkMat, or merge the group). */
export function buildBoneBit(kind: BoneBitKind, rand: Rng): THREE.Group {
  switch (kind) {
    case 'longbone': return buildLongBone(rand);
    case 'ribfan': return buildRibFan(rand);
    case 'spine': return buildSpine(rand);
    case 'vertebra': return buildVertebra(rand);
    case 'carcass': return buildCarcass(rand);
  }
}
