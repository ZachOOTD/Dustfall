// DEEPER cycle 6 (2026-07-26) — UNDERGROUND WATER: still black pools on the floors of the cave.
//
// WHAT THIS IS. A pool is a SECOND WATER-SOURCE KIND. `ctx.waterSources` is already a generic
// registry with hover + E-to-refill (interaction.ts); wells were its only kind and the prompt noun
// was hardcoded. So the integration is: a placement rule, a noun, and a mesh. The refill logic is
// reused as-is — plus one new rule, that a POOL is a real body of water and a WELL is not, which is
// what makes the JERRYCAN (fills at pools only) worth carrying down.
//
// THE COLLISION CONTRACT (rule 9 — collision matches the visible geometry). The water surface gets
// NO COLLIDER. The collider under a pool is the cave floor trimesh that was already baked from the
// SDF surface — i.e. the bottom you can SEE through the water is exactly the surface you WADE on.
// That is only honest because pools are shallow by construction: CAVE_POOL_DEPTH_M (0.26m) above
// the local floor plane, well under the step the KCC clears without noticing. There is no swimming,
// no wading pit, and no invisible floor anywhere in this feature. If a future cycle wants a DEEP
// pool it must carve the basin into the SDF field itself so the collider follows it down — adding a
// second "real" bottom under a fake one is the exact class of bug rule 9 exists to forbid.
//
// PLACEMENT (seed-pure, D290). Pools sit in the true low points of chamber floors. The generator
// already has that signal: `caveFloorSediment` (caveSdf.ts) is the pooled-sand field the floor tint
// uses — where sand collects, water collects. Candidate points are scored on it, then filtered:
//   · never within CAVE_POOL_MOUTH_CLEAR_DEG of a corridor mouth (a pool never blocks a throat),
//   · never over the chamber centre (CENTER_FRAC_MIN) — that keeps the egg chamber's dais and the
//     cave-walk march centreline clear,
//   · the pool RIM must clear the wall, so the disc never pokes into rock.
// Every cave gets at least CAVE_POOL_CHAMBERS_MIN (= 1) pool, deterministically — the probe and the
// player's descent both always find water.
//
// THE MESH IS DELIBERATELY ISOLATED. `buildPoolWaterMesh` is the ONLY place the water's geometry and
// material are constructed, and its material is a flagged PLACEHOLDER (near-black, slightly
// reflective). The hero-visual pass (rule 8, 5-8 rounds: torch reflection, ripple normals, wet-rock
// rim, a bottom fading into depth) replaces this one function and touches nothing else.

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';
import { caveFloorSediment } from './caveSdf.ts';
import type { CaveGraph, CaveNode } from './caveGen.ts';
import { nextWaterSourceId, type WaterSource } from './waterSources.ts';

type Noise3 = (x: number, y: number, z: number) => number;

/** A placed pool, before it becomes geometry. Pure data — the determinism digest and the gate both
 *  read this, so a layout change is visible without diffing vertices. */
export interface CavePoolSpec {
  /** Chamber node this pool sits in. */
  nodeId: number;
  x: number; z: number;
  /** Mean radius (the rim wobbles around it). */
  radius: number;
  /** World Y of the water SURFACE. The floor plane is `waterY - CAVE_POOL_DEPTH_M`. */
  waterY: number;
  /** Sediment score that won this spot (diagnostic — the "why here"). */
  score: number;
}

// ── Placement ──────────────────────────────────────────────────────────────

/** Base radius of the egg chamber's natural rock dais. Defined HERE (and consumed by `buildDais` in
 *  caveGen.ts) so pool placement and the dais can never disagree about how much floor the pedestal
 *  occupies — a pool overlapping it would put water through solid, collider-bearing rock in the one
 *  room every player walks to. The import direction is caveGen → cavePools only; cavePools takes
 *  nothing but types from caveGen, so there is no cycle. */
export function eggDaisRadius(rx: number): number {
  return Math.min(rx * 0.34, 3.4);
}

/** Pick pool sites for a generated cave. Pure: same graph + same noise + same rng stream → the same
 *  specs, in the same order. `dirsByNode` is the generator's per-chamber corridor-direction map (the
 *  same one the speleothems use to keep mouths clear). */
export function placeCavePools(
  graph: CaveGraph,
  cnoise: Noise3,
  rand: () => number,
  dirsByNode: Map<number, Array<{ x: number; z: number }>>,
): CavePoolSpec[] {
  const T = Tuning;
  const cosMouth = Math.cos((T.CAVE_POOL_MOUTH_CLEAR_DEG * Math.PI) / 180);

  // Best candidate site inside one chamber, or null if the room can't hold a pool that clears its
  // mouths and its wall. Scored on the pooled-sediment field — the floor's own low-point signal.
  const bestInNode = (n: CaveNode): CavePoolSpec | null => {
    const rMean = Math.min(T.CAVE_POOL_R_MAX, Math.max(T.CAVE_POOL_R_MIN, Math.min(n.rx, n.rz) * T.CAVE_POOL_R_FRAC));
    // The rim (mean radius + its max outward wobble) must stay inside the walkable floor disk. The
    // SDF flattens the floor to ~0.94·rx, so 0.88 leaves a real margin of dry rock at the wall.
    const rimReach = rMean * (1 + T.CAVE_POOL_EDGE_WOBBLE);
    const maxCentre = Math.min(n.rx, n.rz) * 0.88 - rimReach;
    let minCentre = Math.min(n.rx, n.rz) * T.CAVE_POOL_CENTER_FRAC_MIN;
    // THE EGG CHAMBER. Its centre carries the rock dais the companion egg sits on — collider-bearing
    // geometry, and the destination of every player's walk line. Push the pool clear of the whole
    // pedestal plus a margin of dry floor, so water never intersects the dais and never lands on the
    // approach to it (the cycle-6 spec's "never in the egg chamber's walk line").
    if (n.kind === 'egg') minCentre = Math.max(minCentre, eggDaisRadius(n.rx) + rimReach + 0.6);
    if (maxCentre <= minCentre) return null;                     // room too tight for a pool at all
    const outer = n.kind === 'egg'
      ? maxCentre                                                 // the egg pool is pushed outward by the dais clearance above
      : Math.min(maxCentre, Math.min(n.rx, n.rz) * T.CAVE_POOL_CENTER_FRAC_MAX);
    if (outer <= minCentre) return null;

    const dirs = dirsByNode.get(n.id) ?? [];
    let best: CavePoolSpec | null = null;
    // A deterministic polar lattice — 24 bearings × 3 radial bands. Dense enough that the sediment
    // field's ~10m wavelength is actually sampled inside a 5-12m room; cheap enough to be free.
    const BEARINGS = 24, BANDS = 3;
    for (let b = 0; b < BEARINGS; b++) {
      const ang = (b / BEARINGS) * Math.PI * 2 + n.id * 0.41;    // phase per node: no shared bearing grid
      const ux = Math.cos(ang), uz = Math.sin(ang);
      // Corridor-mouth exclusion: reject the whole bearing if it points into a mouth sector.
      let blocked = false;
      for (const d of dirs) { if (ux * d.x + uz * d.z > cosMouth) { blocked = true; break; } }
      if (blocked) continue;
      for (let k = 0; k < BANDS; k++) {
        const rr = minCentre + ((k + 0.5) / BANDS) * (outer - minCentre);
        const px = n.x + ux * rr, pz = n.z + uz * rr;
        const score = caveFloorSediment(cnoise, px, pz);
        if (!best || score > best.score) {
          best = { nodeId: n.id, x: px, z: pz, radius: rMean, waterY: n.floorY + T.CAVE_POOL_DEPTH_M, score };
        }
      }
    }
    return best;
  };

  // Candidate rooms: every chamber except the entrance hall (the mouth shaft lights it — water there
  // would read as a surface puddle, and it is the one room the player crosses on every trip).
  const cands: CavePoolSpec[] = [];
  for (const n of graph.nodes) {
    if (n.kind === 'entrance') continue;
    const s = bestInNode(n);
    if (s) cands.push(s);
  }
  if (!cands.length) return [];

  // How many pools this cave gets. Drawn from the pool RNG stream so it varies by seed, then clamped
  // to what the rooms can actually hold — but never below CHAMBERS_MIN, so every cave has water.
  const span = T.CAVE_POOL_CHAMBERS_MAX - T.CAVE_POOL_CHAMBERS_MIN + 1;
  const want = Math.min(cands.length, T.CAVE_POOL_CHAMBERS_MIN + Math.floor(rand() * span));
  const target = Math.max(Math.min(cands.length, T.CAVE_POOL_CHAMBERS_MIN), want);

  // Wettest rooms first; ties broken by node id so the order is total and stable.
  cands.sort((a, b) => (b.score - a.score) || (a.nodeId - b.nodeId));
  return cands.slice(0, target).sort((a, b) => a.nodeId - b.nodeId);
}

// ── The water surface (PLACEHOLDER visual — the hero pass replaces this function) ───────────────

/** Shared placeholder water material. Near-black still water with a dim cool specular so a torch
 *  catches the surface; slightly transparent so the floor you are wading on shows through (the
 *  visible bottom IS the collider — see the header). Depth-write OFF so the surface never occludes
 *  the rock behind it at grazing angles.
 *  FLAGGED PLACEHOLDER — DEEPER's hero-visual pass owns the real look. */
const _poolWater = new THREE.MeshPhongMaterial({
  color: Tuning.CAVE_POOL_WATER_HEX,
  specular: Tuning.CAVE_POOL_SPECULAR_HEX,
  shininess: Tuning.CAVE_POOL_SHININESS,
  transparent: true,
  opacity: Tuning.CAVE_POOL_WATER_OPACITY,
  depthWrite: false,
  side: THREE.DoubleSide,   // a genuinely thin, genuinely open surface — rule 7's cloth/grille case
});
// THE FRESNEL PATCH — see CAVE_POOL_FRESNEL_* in tuning.ts. Without it a flat dark sheet lit by a
// near-eye torch renders as a hole in the floor, because a Phong lobe is weakest at exactly the
// grazing angles you view a puddle from. Water is the opposite: reflective toward grazing. Injected
// at `opaque_fragment` (the shipScene.ts glazing precedent) so the lit colour is already resolved.
_poolWater.onBeforeCompile = (shader): void => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `gl_FragColor = vec4( outgoingLight, diffuseColor.a );
     #ifdef OPAQUE
     gl_FragColor.a = 1.0;
     #endif
     float wFres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), ${Tuning.CAVE_POOL_FRESNEL_POW.toFixed(2)});
     gl_FragColor.rgb += vec3(${(((Tuning.CAVE_POOL_FRESNEL_HEX >> 16) & 255) / 255).toFixed(4)}, ${(((Tuning.CAVE_POOL_FRESNEL_HEX >> 8) & 255) / 255).toFixed(4)}, ${((Tuning.CAVE_POOL_FRESNEL_HEX & 255) / 255).toFixed(4)}) * wFres * ${Tuning.CAVE_POOL_FRESNEL_STRENGTH.toFixed(3)};
     gl_FragColor.a = mix(gl_FragColor.a, 1.0, wFres * 0.7);`,
  );
};
_poolWater.customProgramCacheKey = (): string => 'cavePoolWater-v1';

/** The water surface for one pool: a horizontal fan at `waterY` whose rim radius is wobbled by the
 *  cave's colour noise, so it reads as a contour rather than a machined circle. WORLD space (the
 *  cave group carries an identity transform). NO COLLIDER — see the header. */
export function buildPoolWaterMesh(spec: CavePoolSpec, cnoise: Noise3): THREE.Mesh {
  const SEG = Tuning.CAVE_POOL_EDGE_SEGS;
  const pos = new Float32Array((SEG + 1) * 3);
  const nor = new Float32Array((SEG + 1) * 3);
  pos[0] = spec.x; pos[1] = spec.waterY; pos[2] = spec.z;
  nor[1] = 1;
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    // Two octaves of rim wobble, sampled in WORLD space so neighbouring pools never share a shape.
    const w = 1 + (cnoise(spec.x * 0.3 + ca * 2.1, 11.3, spec.z * 0.3 + sa * 2.1) * 0.7
                 + cnoise(spec.x * 0.3 + ca * 5.3, 4.9, spec.z * 0.3 + sa * 5.3) * 0.3) * Tuning.CAVE_POOL_EDGE_WOBBLE;
    const r = spec.radius * w;
    const v = (i + 1) * 3;
    pos[v] = spec.x + ca * r; pos[v + 1] = spec.waterY; pos[v + 2] = spec.z + sa * r;
    nor[v + 1] = 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < SEG; i++) idx.push(0, 1 + ((i + 1) % SEG), 1 + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, _poolWater);
  mesh.name = 'cavePoolWater';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // Render after the opaque cave surface so the transparent sheet blends over the floor beneath it.
  mesh.renderOrder = 2;
  return mesh;
}

// ── Registry records ───────────────────────────────────────────────────────

export interface CavePool {
  spec: CavePoolSpec;
  mesh: THREE.Mesh;
  /** The `ctx.waterSources` record this pool publishes (kind 'pool'). Owned by the cave: attached on
   *  build, detached on eviction — a pool source must never outlive its cave. */
  source: WaterSource;
}

/** Build every pool for a generated cave. The caller adds the meshes to the cave group (so eviction
 *  disposes them with everything else) and publishes `source` into `ctx.waterSources.list`. */
export function buildCavePools(
  graph: CaveGraph,
  cnoise: Noise3,
  rand: () => number,
  dirsByNode: Map<number, Array<{ x: number; z: number }>>,
): CavePool[] {
  const out: CavePool[] = [];
  for (const spec of placeCavePools(graph, cnoise, rand, dirsByNode)) {
    const mesh = buildPoolWaterMesh(spec, cnoise);
    const id = nextWaterSourceId();
    mesh.userData.interactType = 'refill';
    mesh.userData.interactId = id;
    mesh.userData.interactRegistry = 'waterSources';
    mesh.userData.cavePool = true;
    out.push({
      spec,
      mesh,
      source: {
        id,
        kind: 'pool',
        noun: 'pool',
        deepEnoughForLargeVessel: true,
        mesh,
        pos: new THREE.Vector3(spec.x, spec.waterY, spec.z),
        hovered: false,
      },
    });
  }
  return out;
}
