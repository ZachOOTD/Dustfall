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
// THE SURFACE (the hero-visual pass, 10 rounds, `npm run rig -- --scenario=pool-look`).
// `buildPoolWaterMesh` + `createCavePoolMaterial` are still the ONLY place the water's geometry and
// material are constructed (ONE material instance PER CAVE — see `PoolMatState`; the mirrored-emitter
// uniforms are per-cave data and a shared material lost them to whichever cave streamed in last).
// What replaced the placeholder, and WHY — the four things the charter asked for:
//
//  1. A REAL ANSWER TO THE TORCH. MeshStandardMaterial (per-fragment GGX) instead of Phong, so the
//     highlight is a physically-shaped lobe that tracks the light. The lesson from the shot rounds:
//     a light carried AT THE EYE mirrors to a point roughly halfway between your feet and the flame,
//     so the reflection lands on water only when you are standing over it looking down — which is
//     exactly the refill pose. Rounds 1-4 framed from further back and kept grading "no reflection"
//     when the specular was simply outside the frame. Roughness is CAVE_POOL_ROUGH_NEAR (0.11) near /
//     ROUGH_FAR (0.30) far: mirror-tight where you stand, rough enough at range that it can never
//     alias into per-pixel sparkle. And F0 is forced to water's own 0.021 — MeshStandard hardcodes
//     0.04, which is glass, and doubled every return.
//  2. RIPPLE ON THE SPECULAR LOBE. Six crossed travelling waves with a CLOSED-FORM gradient and
//     Laplacian (never a dFdx height bump — D154: screen-space derivatives shimmer as the camera
//     moves). Max slope CAVE_POOL_RIPPLE_SLOPE = 0.36, i.e. ~20 degrees — six times the round-11
//     value, because at 0.05 the modulation was 0.14 of ONE 8-BIT LEVEL and the torch came back as a
//     single smooth Gaussian blob. Still-water subtlety comes from LOW frequency and SLOW speed, not
//     from sub-quantization amplitude. Geometry never moves; only a uTime uniform, pushed once per
//     frame for the whole world from `updateCaveAtmosphere`.
//  2b. WHAT THE WATER MIRRORS. The cave's emissive features (biolum fungi caps) are published once at
//     build into K uniform slots and answered as mirror sources in the same lobe — Fresnel-weighted,
//     ripple-broken into glitter streaks. See `setCavePoolEmitters`. Round 11 had literally zero
//     environmental reflection: caps standing AT a waterline showed nothing in the water beside them.
//  2c. OUTPUT DITHER, in output space (post tone-map, post sRGB). Round 11 measured 290-550px runs of
//     one identical 8-bit value across the pool, with Mach rings between them.
//  3. THE WET RIM. Past the waterline the skirt renders as a DAMP COLLAR — a dark, glossy,
//     hue-neutral film on the stone (wet rock darkens and glosses; it does not turn green), riding
//     CAVE_POOL_WET_LIFT_M above the sampled rock. The surface itself is a shallow LENS, not a disc: full depth across the middle, thinning
//     to a film at the rim, then falling at ~0.11 m/m across a 0.75m shore band. The cave floor
//     carries ±7.5cm of un-attenuated micro-relief (CAVE_SDF_MICRO_AMP), and the water measures its
//     depth against the REAL ROCK (`makeFloorSampler` reads the SDF surface's own vertices) and
//     discards where that depth reaches zero. So the waterline is CUT BY THE STONE — an organic
//     contour with gravel standing out of it and a damp film clinging to the rock between the bumps.
//     No decal ring, no second mesh, nothing floating. The shore GRADIENT is the load-bearing number:
//     at the round-6 value (~0.8 m/m) the relief could only move the waterline 9cm and it read as a
//     scalloped polygon; the shallow gradient lets the same relief swing it the better part of a metre.
//  4. DEPTH. Beer-Lambert on that measured depth: the shallows show wet stone plainly, the middle
//     absorbs to near-black. Plus the wave Laplacian modulating TRANSMISSION, which makes the bottom
//     brighten and dim in slow bands — light-gated for free, because it multiplies whatever is behind
//     the surface, so it appears only where the torch reaches and is invisible in the dark.
//
// Everything is uniforms (no baked literals → one program, no customProgramCacheKey needed — D207),
// the placement above is untouched, and the water still has NO COLLIDER.

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

// ── The water surface (the DEEPER cycle-6 hero visual) ──────────────────────────────────────────
//
// See the CAVE_POOL_* block in tuning.ts for the four ideas this is built on (shelving geometry →
// a real jagged waterline, Beer-Lambert depth, a GGX answer to the torch, analytic ripple normals).
// Everything the look needs lives in THIS material + THIS mesh builder; nothing else in the game
// changes, and neither the placement (`placeCavePools`) nor any collider is touched.

const _hex = (h: number): THREE.Vector3 =>
  new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);

/** ── ONE MATERIAL INSTANCE PER CAVE (round-13 code critique, sev-2) ───────────────────────────
 *
 *  THE BUG THIS FIXES. The emitter slots (`uPoolEmit`) are per-CAVE data — this cave's fungi, at
 *  this cave's world coordinates. Round 12 held them in module-global arrays bound into ONE shared
 *  material, and `setCavePoolEmitters` overwrote all K slots wholesale at every cave build. With
 *  `CAVE_RESIDENT_MAX` = 3 that is not hypothetical: walk within streaming range of a second cave
 *  and the cave you are STANDING IN loses its mushroom reflections to a cave 300m away (and gains
 *  mirror sources at coordinates its own water cannot see, which the inverse-square term then
 *  silently kills — so the failure reads as "the reflections just stopped").
 *
 *  THE FIX. Each cave gets its OWN material instance with its OWN emitter arrays. three shares the
 *  compiled PROGRAM across them automatically — the shader source is identical and the program
 *  cache key is pinned to a constant below — so the cost of N instances is N uniform sets, which is
 *  exactly what per-instance uniforms exist for. The instance is registered live at build and
 *  DISPOSED at cave eviction (`releaseCavePoolMaterial`, called from caveStream's dispose path,
 *  which otherwise deliberately skips module-shared materials).
 *
 *  Live shader refs are likewise per material, so `updateCavePoolWater` writes the ripple clock to
 *  exactly the live caves' programs (≤ CAVE_RESIDENT_MAX × WATER_SHADER_CAP entries, and the whole
 *  list goes away with the cave). `onBeforeCompile` runs again on every program recompile — a
 *  `needsUpdate`, a renderer context restore — so the list is hard-capped; the identity dedupe is a
 *  belt-and-braces guard only (three hands out a FRESH shader object per compile, so it does not
 *  fire in practice — the CAP and the per-cave lifetime are what actually bound this). */
type PoolShader = { uniforms: Record<string, { value: unknown }> };
const WATER_SHADER_CAP = 4;

interface PoolMatState {
  /** THIS cave's mirrored emitters: xyz world, w = intensity (0 ⇒ an unused slot). */
  emitPos: THREE.Vector4[];
  emitCol: THREE.Vector3[];
  /** Compiled-shader refs for THIS material. */
  shaders: PoolShader[];
}

/** Every live per-cave pool material. Bounded by CAVE_RESIDENT_MAX; entries are removed by
 *  `releaseCavePoolMaterial` on eviction. `cavePoolLiveMaterials()` publishes the size so the
 *  streaming leak canary can watch it. */
const _liveMaterials = new Map<THREE.Material, PoolMatState>();

const _trackWaterShader = (st: PoolMatState, s: PoolShader): void => {
  if (st.shaders.indexOf(s) >= 0) return;
  st.shaders.push(s);
  if (st.shaders.length > WATER_SHADER_CAP) st.shaders.splice(0, st.shaders.length - WATER_SHADER_CAP);
};

/** ── THE MIRRORED EMITTERS (round-12 finding 4: "zero environmental reflection").
 *
 *  A pool with nothing in it but a punctual light's own highlight is a black pane with a hotspot, not
 *  a mirror — and the r11 shots proved it: bioluminescent mushrooms standing AT the waterline showed
 *  nothing at all in the water two feet away. A render-target planar mirror is the correct fix and is
 *  unaffordable (a second scene pass per pool, in the middle of a chunk-streaming budget).
 *
 *  So: the cave's emissive features are collected ONCE at build into K uniform slots, and the water's
 *  fragment shader treats each as a MIRROR SOURCE — reflect the view vector about the rippled surface
 *  normal and answer with a tight lobe toward the emitter, Fresnel-weighted (so it is a whisper
 *  head-on and near-full at grazing, the way real water behaves) and inverse-square attenuated. The
 *  same ripple normal that shatters the torch's highlight shatters these into glitter STREAKS.
 *
 *  Cost: zero per frame (written at build), K dot-products per water fragment. Determinism: the
 *  emitter list is derived from the already-seed-pure fungi placement and sorted by a total order, so
 *  the same seed produces the same K slots in the same order. */
const GLINT_K = Tuning.CAVE_POOL_GLINT_MAX;

export interface PoolEmitter { x: number; y: number; z: number; intensity: number; color: THREE.Color }

/** Publish ONE CAVE's mirrored-emitter set into THAT CAVE's water material (call once, at cave build,
 *  AFTER pools are placed). Emitters are ranked by how much they can actually contribute to any pool
 *  — nearest-first, capped at CAVE_POOL_GLINT_RANGE_M — then written into the K slots. Slots past the
 *  list are zeroed, so a cave with no fungi near water simply has no environment term.
 *
 *  `material` is the instance `buildCavePools` created for this cave; a cave with no pools has none
 *  and there is nothing to publish. Writing into a per-cave instance is the whole point — see the
 *  block above `PoolMatState`: the module-global version of this function stole the live cave's
 *  reflections every time a second cave streamed in. */
export function setCavePoolEmitters(
  material: THREE.Material | null | undefined,
  emitters: PoolEmitter[],
  pools: CavePoolSpec[],
): void {
  if (!material) return;
  const st = _liveMaterials.get(material);
  if (!st) { console.error('[cavePools] setCavePoolEmitters: material is not a live pool material'); return; }
  const R = Tuning.CAVE_POOL_GLINT_RANGE_M;
  const scored = emitters.map((e) => {
    let best = Infinity;
    for (const p of pools) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < best) best = d; }
    return { e, d: best };
  }).filter((s) => s.d <= R)
    // Nearest to water first; ties broken by world position so the order is TOTAL and seed-stable.
    .sort((a, b) => (a.d - b.d) || (a.e.x - b.e.x) || (a.e.z - b.e.z) || (a.e.y - b.e.y));
  for (let i = 0; i < GLINT_K; i++) {
    const s = scored[i];
    if (s) { st.emitPos[i].set(s.e.x, s.e.y, s.e.z, s.e.intensity); st.emitCol[i].set(s.e.color.r, s.e.color.g, s.e.color.b); }
    else { st.emitPos[i].set(0, 0, 0, 0); st.emitCol[i].set(0, 0, 0); }
  }
  // The uniform VALUES are the same array objects this material's shaders hold, so live programs pick
  // this up with no re-upload bookkeeping; the loop below only matters for uniforms three caches by
  // identity — and it touches THIS material's programs only.
  for (const sh of st.shaders) {
    if (sh.uniforms.uPoolEmit) sh.uniforms.uPoolEmit.value = st.emitPos;
    if (sh.uniforms.uPoolEmitCol) sh.uniforms.uPoolEmitCol.value = st.emitCol;
  }
}

/** Read back a live pool material's emitter slots (probe/gate hook — `pool-fill`'s two-cave leg
 *  asserts that building cave B does not disturb cave A's slots). */
export function readCavePoolEmitters(material: THREE.Material): Array<[number, number, number, number]> | null {
  const st = _liveMaterials.get(material);
  return st ? st.emitPos.map((v) => [v.x, v.y, v.z, v.w] as [number, number, number, number]) : null;
}

/** How many per-cave pool materials are alive right now. Bounded by CAVE_RESIDENT_MAX; a number that
 *  climbs across a streaming round trip is a material leak (the chunk-perf registry canary reads it). */
export function cavePoolLiveMaterials(): number { return _liveMaterials.size; }

/** Drop a per-cave pool material: unregister it from the ripple clock and dispose it. Idempotent, and
 *  a no-op on anything that is not a live pool material — caveStream's dispose path calls it per
 *  pool mesh, and several pools in one cave share the one instance. Returns true if it disposed. */
export function releaseCavePoolMaterial(material: THREE.Material | THREE.Material[]): boolean {
  if (Array.isArray(material)) { let any = false; for (const m of material) any = releaseCavePoolMaterial(m) || any; return any; }
  const st = _liveMaterials.get(material);
  if (!st) return false;
  _liveMaterials.delete(material);
  st.shaders.length = 0;
  material.dispose();
  return true;
}

/** THE PER-CAVE water material. Standard (per-fragment GGX) rather than Phong specifically so the
 *  torch — a punctual light a metre from the eye — produces a *reflection-shaped* highlight that
 *  lives and moves, instead of Phong's fuzzy lobe. Transparent + depthWrite OFF: the surface must
 *  never occlude the rock bottom that it is showing you (and that you are standing on).
 *
 *  One instance per cave (see the `PoolMatState` block). `customProgramCacheKey` is pinned to a
 *  CONSTANT so three provably shares one compiled program across every instance — the shader source
 *  is byte-identical between them and only the uniform VALUES differ. (three's default key is
 *  `onBeforeCompile.toString()`, which would already collapse to one key here since every instance
 *  gets the same closure source; pinning it makes that a guarantee rather than a coincidence.) */
export function createCavePoolMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: Tuning.CAVE_POOL_WATER_HEX,
    roughness: Tuning.CAVE_POOL_ROUGH_NEAR,
    metalness: 0.0,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,   // a genuinely thin, genuinely open surface — rule 7's cloth/grille case
  });
  mat.name = 'cavePoolWater';
  const st: PoolMatState = { emitPos: [], emitCol: [], shaders: [] };
  for (let i = 0; i < GLINT_K; i++) { st.emitPos.push(new THREE.Vector4(0, 0, 0, 0)); st.emitCol.push(new THREE.Vector3(0, 0, 0)); }
  // Probe hooks: the live shader refs (so a gate can poke a uniform to prove a metric has teeth) and
  // the anchor-match flag (fix 6a — a silent chunk-name drift on a three upgrade must FAIL a gate).
  mat.userData.poolShaders = st.shaders;
  mat.userData.poolShaderAnchorsOk = true;
  mat.onBeforeCompile = (shader): void => { applyPoolShader(mat, st, shader); };
  mat.customProgramCacheKey = (): string => 'cavePoolWater-v1';
  _liveMaterials.set(mat, st);
  return mat;
}

/** GLSL injection sites this shader owns. Each is asserted to have MATCHED (fix 6a): a three upgrade
 *  that renames or re-orders a chunk would otherwise leave a plausible-looking but WRONG surface —
 *  no ripple normal, no Fresnel floor, no waterline discard — and every existing gate would still be
 *  green, because they all measure a surface that renders. A miss is loud AND sets a flag the
 *  `pool-fill` gate asserts. */
function applyPoolShader(
  mat: THREE.Material,
  st: PoolMatState,
  shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string },
): void {
  // All per-look values are UNIFORMS, not baked literals (D207) — one program shared by every
  // instance, and the emitter arrays below are what makes each instance its own cave.
  const u = shader.uniforms as Record<string, { value: unknown }>;
  u.uPoolTime = { value: 0 };
  u.uPoolRipSlope = { value: Tuning.CAVE_POOL_RIPPLE_SLOPE };
  u.uPoolRipScale = { value: Tuning.CAVE_POOL_RIPPLE_SCALE };
  u.uPoolRipSpeed = { value: Tuning.CAVE_POOL_RIPPLE_SPEED };
  u.uPoolRipFade = { value: Tuning.CAVE_POOL_RIPPLE_FADE_M };
  u.uPoolRipDampD = { value: Tuning.CAVE_POOL_RIPPLE_DAMP_D };
  u.uPoolRoughNear = { value: Tuning.CAVE_POOL_ROUGH_NEAR };
  u.uPoolRoughFar = { value: Tuning.CAVE_POOL_ROUGH_FAR };
  u.uPoolRoughA = { value: Tuning.CAVE_POOL_ROUGH_FADE_A };
  u.uPoolRoughB = { value: Tuning.CAVE_POOL_ROUGH_FADE_B };
  u.uPoolAbsorb = { value: Tuning.CAVE_POOL_ABSORB };
  u.uPoolAlphaMin = { value: Tuning.CAVE_POOL_ALPHA_MIN };
  u.uPoolAlphaMax = { value: Tuning.CAVE_POOL_ALPHA_MAX };
  u.uPoolDeep = { value: _hex(Tuning.CAVE_POOL_DEEP_HEX) };
  u.uPoolAlbedo = { value: _hex(Tuning.CAVE_POOL_ALBEDO_HEX) };
  u.uPoolF0 = { value: Tuning.CAVE_POOL_F0 };
  u.uPoolFresPow = { value: Tuning.CAVE_POOL_FRESNEL_POW };
  u.uPoolFresAlpha = { value: Tuning.CAVE_POOL_FRESNEL_ALPHA };
  u.uPoolSpecAlpha = { value: Tuning.CAVE_POOL_SPEC_ALPHA };
  u.uPoolCaustic = { value: Tuning.CAVE_POOL_CAUSTIC };
  u.uPoolEdgeJit = { value: Tuning.CAVE_POOL_EDGE_JITTER };
  u.uPoolEdgeFreq = { value: Tuning.CAVE_POOL_EDGE_JITTER_FREQ };
  u.uPoolEdgeLobe = { value: Tuning.CAVE_POOL_EDGE_LOBE };
  u.uPoolEdgeLobeF = { value: Tuning.CAVE_POOL_EDGE_LOBE_FREQ };
  u.uPoolGravelF = { value: Tuning.CAVE_POOL_GRAVEL_FREQ };
  u.uPoolGravelA = { value: Tuning.CAVE_POOL_GRAVEL_AMP };
  u.uPoolDither = { value: Tuning.CAVE_POOL_DITHER };
  u.uPoolGlintStr = { value: Tuning.CAVE_POOL_GLINT_STRENGTH };
  u.uPoolGlintSharp = { value: Tuning.CAVE_POOL_GLINT_SHARP };
  u.uPoolGlintFall = { value: Tuning.CAVE_POOL_GLINT_FALL };
  u.uPoolEmit = { value: st.emitPos };          // THIS CAVE's mirror sources — never a module global
  u.uPoolEmitCol = { value: st.emitCol };
  u.uPoolWetBand = { value: Tuning.CAVE_POOL_WET_BAND_M };
  u.uPoolWetDark = { value: Tuning.CAVE_POOL_WET_DARK };
  u.uPoolWetGloss = { value: Tuning.CAVE_POOL_WET_GLOSS_M };
  // The shore's own fall-rate, so the shader can turn a signed DEPTH into metres-past-the-waterline
  // without a second attribute (and can never disagree with `depthOuter`'s geometry).
  u.uPoolShoreGrad = { value: (Tuning.CAVE_POOL_FILM_M + Tuning.CAVE_POOL_SHORE_FALL) / Tuning.CAVE_POOL_SHORE_M };
  _trackWaterShader(st, shader as unknown as PoolShader);

  // ── THE MATCHED-ANCHOR GUARD (fix 6a). `String.replace` with a string pattern is SILENT on a miss:
  //    it returns the source unchanged. Nine chunk names below are load-bearing, and a three upgrade
  //    that renames or splits any of them would leave a surface that still renders — just without a
  //    waterline discard, or without the ripple normal, or without the Fresnel floor. Every gate in
  //    this feature would stay green on that surface, because they all measure a thing that draws.
  //    So each injection compares before/after and a miss is (a) loud on the console and (b) recorded
  //    on the material's userData, which `pool-fill` asserts false. Replacement bodies go in via a
  //    CALLBACK so `$&`/`$'` in GLSL can never be interpreted as a replacement pattern.
  const misses: string[] = [];
  let vs = shader.vertexShader, fs = shader.fragmentShader;
  const injV = (anchor: string, body: string): void => {
    const next = vs.replace(anchor, () => body);
    if (next === vs) misses.push('vertex ' + anchor);
    vs = next;
  };
  const injF = (anchor: string, body: string): void => {
    const next = fs.replace(anchor, () => body);
    if (next === fs) misses.push('fragment ' + anchor);
    fs = next;
  };

  // ── VERTEX: forward the world position (ripple domain) and the per-vertex WATER DEPTH the mesh
  //    builder baked in. Depth is the whole optical model, so it must be an attribute, not a radius
  //    guessed in the fragment shader — the rim is wobbled and the shelf is not a circle.
  injV('#include <common>', `#include <common>
      attribute float aPoolDepth;
      varying vec3 vPoolW;
      varying float vPoolD;`);
  injV('#include <begin_vertex>', `#include <begin_vertex>
      vPoolW = (modelMatrix * vec4(position, 1.0)).xyz;
      vPoolD = aPoolDepth;`);

  injF('#include <common>', `#include <common>
      uniform float uPoolTime, uPoolRipSlope, uPoolRipScale, uPoolRipSpeed, uPoolRipFade, uPoolRipDampD;
      uniform float uPoolRoughNear, uPoolRoughFar, uPoolRoughA, uPoolRoughB;
      uniform float uPoolAbsorb, uPoolAlphaMin, uPoolAlphaMax;
      uniform float uPoolFresPow, uPoolFresAlpha, uPoolSpecAlpha, uPoolCaustic, uPoolF0;
      uniform float uPoolEdgeJit, uPoolEdgeFreq, uPoolEdgeLobe, uPoolEdgeLobeF;
      uniform float uPoolGravelF, uPoolGravelA, uPoolDither;
      uniform float uPoolGlintStr, uPoolGlintSharp, uPoolGlintFall;
      uniform float uPoolWetBand, uPoolWetDark, uPoolWetGloss, uPoolShoreGrad;
      uniform vec4 uPoolEmit[${GLINT_K}];
      uniform vec3 uPoolEmitCol[${GLINT_K}];
      uniform vec3 uPoolDeep, uPoolAlbedo;
      varying vec3 vPoolW;
      varying float vPoolD;
      // IQ integer-style hash: the naive fract(sin(dot(...))*BIG) collapses at cave world coords
      // (hundreds of metres) because single-precision cannot resolve the per-fragment delta.
      float poolHash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float poolNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(poolHash(i), poolHash(i + vec2(1.0, 0.0)), u.x),
                   mix(poolHash(i + vec2(0.0, 1.0)), poolHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }`);

    // ── THE RIPPLE FIELD + DEPTH → COLOUR/ALPHA. All the wave maths happens HERE, at the first
    //    injection slot in main(), because everything downstream wants a piece of it: the alpha
    //    (this block), the roughness ramp, and the normal. SIX crossed travelling waves with a
    //    CLOSED-FORM gradient and Laplacian — never a dFdx height bump, which shimmers as the camera
    //    moves (D154). Geometry stays static and seed-pure; only `uPoolTime` animates.
    //
    //    DEPTH is Beer-Lambert on the per-vertex water depth: the shore film barely tints the stone,
    //    the middle absorbs toward `uPoolDeep` and swallows the bottom.
    //
    //    The LAPLACIAN is the caustic/refraction cheat. Where the surface is convex it gathers light
    //    and where it is concave it spreads it; modulating the water's ALPHA by that term makes the
    //    bottom brighten and dim in slow bands, which is what you actually see through moving water.
    //    Because it is MULTIPLICATIVE against whatever is behind the surface, it is light-gated for
    //    free — it appears only where the torch is actually reaching the bottom, and is invisible in
    //    the black. That is the cue that makes a dark sheet read as WATER rather than as wet slate,
    //    and it costs six sines. A screen-space transmission pass would have given true refraction
    //    but costs a second render of the scene every frame — not affordable for cave dressing.
    injF('#include <color_fragment>', `#include <color_fragment>
      // THE WATERLINE. Past it the mesh's skirt has sunk below the floor plane — but "below the
      // floor plane" only means BURIED where the rock happens to be high, and the floor carries
      // only ±7.5cm of micro-relief, so the skirt was surfacing in flat lit patches over the stone.
      // Discard it outright: the water ends where its depth reaches zero, exactly, and every
      // remaining fragment is real water over real bottom.
      // …and the mesh resolves that contour at ~18cm (2πr / CAVE_POOL_EDGE_SEGS = 88, at a ~2.5m
      // rim), which cut the waterline into long straight
      // facets. A little high-frequency jitter ON THE DEPTH, confined to a band either side of zero,
      // ravels the boundary back into gravel-scale raggedness without touching the water body.
      // …and (round-12 finding 6) the gravel-scale jitter alone left the CONTOUR ITSELF straight: the
      // far waterline measured ruler-straight to ±3px over 340px, because ±2.6cm of depth over a
      // 0.11 m/m shore can only move the line ~24cm — under the mesh's own facet size. A THIRD,
      // LOW-frequency octave (~1.8m lobes, ±5.5cm) swings the same contour by ~0.5m, so the pool
      // interlocks with the rock in PLAN. This wanders the mesh contour only; the placement spec
      // (centre, radius, count) is byte-identical, which is what the determinism digest reads.
      float poolJn = (poolNoise(vPoolW.xz * uPoolEdgeFreq) - 0.5) * 1.00
                   + (poolNoise(vPoolW.xz * uPoolEdgeFreq * 4.5) - 0.5) * 0.45;
      float poolLobe = (poolNoise(vPoolW.xz * uPoolEdgeLobeF) - 0.5) * 2.0
                     + (poolNoise(vPoolW.xz * uPoolEdgeLobeF * 2.3) - 0.5) * 0.9;
      float poolDj = vPoolD + poolLobe * uPoolEdgeLobe
                   + poolJn * uPoolEdgeJit
                     * (1.0 - smoothstep(0.0, uPoolEdgeJit * 3.0, abs(vPoolD)));
      // THE WET COLLAR (round-12 finding 5). Past the waterline the skirt no longer vanishes: for
      // WET_BAND metres it renders as DAMP STONE — a dark, low-alpha, glossy film over the rock,
      // which is what wet stone is. Wet rock DARKENS and GLOSSES; it does not change hue, so this
      // adds no colour at all, only opacity and specular. Past the band it is discarded outright.
      float poolWetCollar = 0.0, poolWetContact = 0.0;
      if (poolDj <= 0.0) {
        // depth → metres past the waterline, via the shore's own gradient (FILM+SHORE_FALL)/SHORE_M.
        float outM = -poolDj / uPoolShoreGrad;
        if (outM >= uPoolWetBand) discard;
        poolWetCollar = 1.0 - smoothstep(0.0, uPoolWetBand, outM);
        poolWetContact = 1.0 - smoothstep(0.0, uPoolWetGloss, outM);
      }
      float poolDist = length(vPoolW - cameraPosition);
      float poolNear = 1.0 - smoothstep(uPoolRipFade * 0.35, uPoolRipFade, poolDist);
      vec2 pw = vPoolW.xz * uPoolRipScale;
      float tt = uPoolTime * uPoolRipSpeed;
      vec2 pd1 = vec2(0.940, 0.342), pd2 = vec2(-0.515, 0.857), pd3 = vec2(0.276, -0.961), pd4 = vec2(0.771, 0.637);
      vec2 pd5 = vec2(-0.951, 0.309), pd6 = vec2(0.454, -0.891);
      float pk1 = 1.0, pk2 = 2.13, pk3 = 4.37, pk4 = 9.10, pk5 = 17.3, pk6 = 31.0;
      float pp1 = dot(pw, pd1) * pk1 + tt;
      float pp2 = dot(pw, pd2) * pk2 - tt * 0.77;
      float pp3 = dot(pw, pd3) * pk3 + tt * 1.63;
      float pp4 = dot(pw, pd4) * pk4 - tt * 2.40;
      float pp5 = dot(pw, pd5) * pk5 + tt * 3.10;
      float pp6 = dot(pw, pd6) * pk6 - tt * 4.05;
      float poolWet = smoothstep(0.0, uPoolRipDampD, poolDj);
      // Waves 5 and 6 (round-12c) exist ONLY to lengthen the glint path. With four waves the surface
      // normal is smooth at the scale of a specular footprint, so the torch's reflection came back as
      // one short dash and the mirrored fungi came back as smooth vector-like ARCS — a contour plot,
      // not glitter. Two more octaves at k=17.3/31 (23cm and 13cm wavelengths, at RIPPLE_SCALE 1.60)
      // carry ~13% of the slope
      // between them: far too little to disturb the still-water read, and exactly enough to shatter a
      // mirror lobe into a broken column. They are damped by the SAME distance fade as the rest, so
      // they cannot alias into per-pixel sparkle across the room.
      vec2 poolG = (pd1 * (1.000 * pk1 * cos(pp1))
                  + pd2 * (0.520 * pk2 * cos(pp2))
                  + pd3 * (0.190 * pk3 * cos(pp3))
                  + pd4 * (0.050 * pk4 * cos(pp4))
                  + pd5 * (0.0205 * pk5 * cos(pp5))
                  + pd6 * (0.0068 * pk6 * cos(pp6))) * uPoolRipSlope * poolWet * poolNear;
      // The 4th wave is a CAUSTIC wave: amplitude 0.05 contributes almost nothing to the height or
      // the slope, but the Laplacian weights by k SQUARED, so at k=9.1 it dominates the focusing
      // term and sets the caustic band scale (~50cm) independently of the ripple's own wavelength.
      // Waves 5 and 6 join it (round-12f): the Laplacian weights by k SQUARED, so the 23cm and 13cm
      // octaves dominate the focusing term and give the transmitted bottom structure at pebble scale
      // instead of the ~50cm smooth bands wave 4 alone produced. That is what a shallow rock-bottomed
      // pool looks like under a moving surface, and it is the term the r11 critique measured as
      // "modulation 0.14 of one 8-bit level" — the bottom read as a smooth tinted pane.
      float poolLap = -(1.000 * pk1 * pk1 * sin(pp1)
                      + 0.520 * pk2 * pk2 * sin(pp2)
                      + 0.190 * pk3 * pk3 * sin(pp3)
                      + 0.050 * pk4 * pk4 * sin(pp4)
                      + 0.0205 * pk5 * pk5 * sin(pp5)
                      + 0.0068 * pk6 * pk6 * sin(pp6)) * 0.031;
      float poolAbs = 1.0 - exp(-uPoolAbsorb * max(poolDj, 0.0));
      // ── FINDING 1: KILL THE DIFFUSE. The body albedo is overwritten outright (never the material's
      //    sRGB-decoded colour property), at <=0.016 per channel: 3-5x darker than r11 and,
      //    critically, NEUTRAL-COLD rather than saturated. With an albedo this low the Lambert term
      //    is numerically irrelevant next to the specular, which is the whole point — what colour the
      //    water reads is then the colour of the LIGHT it is reflecting, under any lamp. That is what
      //    kills "olive under the torch, cobalt under the flashlight".
      diffuseColor.rgb = mix(uPoolAlbedo, uPoolDeep, poolAbs);
      // ── FINDING 7: THE BOTTOM. Beer-Lambert already darkened with depth; what was missing is that
      //    the shallows had no BED. We cannot texture the rock from here, but we can vary how much of
      //    it the water lets through at pebble scale — two octaves of value noise on the alpha,
      //    strongest where the water is shallow and fading out as the middle goes opaque. Result: the
      //    shallows read gravel, the centre reads a hole.
      float poolGrav = (poolNoise(vPoolW.xz * uPoolGravelF) - 0.5) * 1.0
                     + (poolNoise(vPoolW.xz * uPoolGravelF * 2.7) - 0.5) * 0.5;
      float poolBed = 1.0 + poolGrav * uPoolGravelA * (1.0 - poolAbs);
      diffuseColor.a = clamp(mix(uPoolAlphaMin, uPoolAlphaMax, poolAbs)
                             * (1.0 - poolLap * uPoolCaustic * poolWet * poolNear)
                             * poolBed
                             * smoothstep(0.0, 0.004, poolDj), 0.0, 1.0);
      // The DAMP COLLAR overrides all of it: black film, alpha = the darkening we want on the stone.
      if (poolWetCollar > 0.0) {
        diffuseColor.rgb = vec3(0.0);
        diffuseColor.a = uPoolWetDark * poolWetCollar;
      }`);

    // ── ROUGHNESS BY RANGE. Still water at your feet is a mirror; the same mirror across the room
    //    would alias the ripple highlight into per-pixel sparkle, so it roughens with distance.
    injF('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(uPoolRoughNear, uPoolRoughFar, smoothstep(uPoolRoughA, uPoolRoughB, poolDist));
      // The damp collar is STONE, not water: matte a hand's-width out, full gloss at the contact
      // strip. That gradient — not a colour change — is the whole wet-rock signature.
      roughnessFactor = mix(mix(0.62, 0.15, poolWetCollar), roughnessFactor, max(poolWetContact, step(0.0001, poolDj)));`);

    // ── THE FRESNEL FLOOR. MeshStandard hardcodes F0 = 0.04 for a dielectric — that is GLASS. Water
    //    is IOR 1.333, i.e. F0 ≈ 0.021, so every specular return in r11 was ~2× too strong at normal
    //    incidence. Schlick still carries it to ~1 at grazing, which is the behaviour the critics
    //    measured as MISSING (r11's brightness FELL toward grazing — the signature of pure Lambert).
    injF('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      material.specularColor = vec3(uPoolF0);
      material.specularColorBlended = vec3(uPoolF0);   // three r184: this is the field BRDF_GGX reads
      material.specularF90 = 1.0;`);

    // ── THE RIPPLE NORMAL. `viewMatrix` (not normalMatrix, which the fragment stage does not
    //    declare) takes the world-space wave normal into the view space the lighting wants.
    injF('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // The collar is stone: it keeps the flat floor normal (a rippling wet ROCK would be nonsense).
      vec3 poolNw = normalize(vec3(-poolG.x * step(0.0001, poolDj), 1.0, -poolG.y * step(0.0001, poolDj)));
      normal = normalize(mat3(viewMatrix) * poolNw);`);

    // ── FRESNEL + THE SPECULAR-OPACITY RULE. Toward grazing the surface stops transmitting and
    //    becomes a mirror of near-black rock: that is an ALPHA move, not a colour wash (the wash is
    //    what made the placeholder read chalky). And wherever the surface is genuinely bright — i.e.
    //    it IS answering the torch — it must go opaque, or alpha blending would fade the one thing
    //    the whole pool exists to show.
    //
    //    ⚠ FRAGILE INJECTION — THE ONE REPLACEMENT THAT DOES NOT PRESERVE ITS CHUNK. Every other
    //    injection here re-emits `#include <…>` and appends; this one REPLACES `opaque_fragment`
    //    wholesale, because the Fresnel/glint terms must land between the chunk's `gl_FragColor`
    //    write and the end of main(). Three's stock chunk is:
    //        #ifdef OPAQUE            diffuseColor.a = 1.0;              #endif
    //        #ifdef USE_TRANSMISSION  diffuseColor.a *= material.transmissionAlpha;  #endif
    //        gl_FragColor = vec4( outgoingLight, diffuseColor.a );
    //    — i.e. the USE_TRANSMISSION line is DELIBERATELY DROPPED here (this material never sets
    //    `transmission`, so `material.transmissionAlpha` does not exist in its program and copying
    //    the line would not compile). ON A THREE UPGRADE, RE-READ THE STOCK CHUNK: anything new that
    //    lands between the `#ifdef OPAQUE` block and the `gl_FragColor` write is silently lost here.
    //    The matched-anchor guard catches a RENAME; it cannot catch an added line, so this comment
    //    is the check. (Restructuring to append-only is not trivial: the added terms have to modify
    //    `gl_FragColor` after it is written, and appending after the chunk would put them before
    //    `<tonemapping_fragment>` — which is in fact where they belong and where they now run.)
    injF('#include <opaque_fragment>', `gl_FragColor = vec4( outgoingLight, diffuseColor.a );
      #ifdef OPAQUE
      gl_FragColor.a = 1.0;
      #endif
      // ── FINDING 4: THE ENVIRONMENT MUST APPEAR IN THE SURFACE.
      //    r11 added a flat Fresnel COLOUR (a near-black grey, gated on how lit the fragment already
      //    was). That is a wash, not a reflection: it carries no information about what is standing
      //    at the waterline, which is exactly why bioluminescent mushrooms two feet from the water
      //    mirrored NOTHING. It is deleted. In its place, the K mirrored emitters published at cave
      //    build are answered with a real specular lobe:
      //      · reflect the view vector about the RIPPLED surface normal (world space),
      //      · a tight power lobe toward each emitter — width tied to the same roughness the GGX
      //        lobe uses, so the two agree about how mirror-like this patch of water is,
      //      · inverse-square attenuation, and
      //      · SCHLICK FRESNEL, so it is a whisper head-on (F0 ≈ 0.02) and near-full at grazing.
      //    Because the normal is rippled, a single emitter does not land as one dot: it smears into
      //    a broken glitter STREAK along the view direction, which is what a light source over
      //    disturbed water actually looks like. No render target, no second pass, no per-frame cost.
      vec3 poolVw = normalize(cameraPosition - vPoolW);
      float poolNdV = clamp(dot(poolNw, poolVw), 0.0, 1.0);
      float poolFres = uPoolF0 + (1.0 - uPoolF0) * pow(1.0 - poolNdV, uPoolFresPow);
      vec3 poolRw = reflect(-poolVw, poolNw);
      float poolSharp = uPoolGlintSharp / max(roughnessFactor * roughnessFactor, 0.0006);
      vec3 poolGlint = vec3(0.0);
      for (int gi = 0; gi < ${GLINT_K}; gi++) {
        vec4 em = uPoolEmit[gi];
        vec3 dl = em.xyz - vPoolW;
        float dd = max(length(dl), 0.05);
        float ca = max(dot(poolRw, dl / dd), 0.0);
        poolGlint += uPoolEmitCol[gi] * (em.w * pow(ca, poolSharp) / (1.0 + dd * dd * uPoolGlintFall));
      }
      // Water only. The damp collar is stone and mirrors nothing but its own GGX highlight.
      gl_FragColor.rgb += poolGlint * poolFres * uPoolGlintStr * step(0.0001, poolDj);
      float poolLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      // The collar is an opacity-only effect: its alpha is the darkening, plus whatever gloss it is
      // actually returning. Water keeps the black-mirror rule (grazing ⇒ opaque) and the
      // specular-opacity rule (a lit fragment must never be faded out by transparency).
      gl_FragColor.a = clamp(gl_FragColor.a
                             + (poolFres * uPoolFresAlpha) * step(0.0001, poolDj)
                             + poolLum * uPoolSpecAlpha, 0.0, 1.0);`);

    // ── FINDING 3: OUTPUT DITHER. The r11 pool showed 290-550px runs of ONE identical 8-bit value
    //    with Mach rings between them — the ripple was modulating the signal by 0.14 of a level, so
    //    quantization ate it whole. Dither has to happen in OUTPUT space (post tone-map, post sRGB
    //    encode), because sRGB's slope near black is ~12×: a ±1/255 perturbation added in LINEAR
    //    space would come out as a dozen levels down here. `dithering_fragment` is the last chunk in
    //    the shader, which is exactly the right place. Interleaved-gradient noise rather than a hash:
    //    its spectrum is blue-ish, so the break-up reads as film grain, not as static.
    injF('#include <dithering_fragment>', `#include <dithering_fragment>
      float poolIgn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      gl_FragColor.rgb += vec3((poolIgn - 0.5) * (uPoolDither / 255.0));`);

  shader.vertexShader = vs;
  shader.fragmentShader = fs;
  if (misses.length) {
    // LOUD, and recorded. A miss means the surface still draws but is no longer the surface this
    // feature designed, reviewed and gated — which is strictly worse than not drawing at all.
    console.error('[cavePools] SHADER ANCHOR MISS — three chunk names moved: ' + misses.join(', ')
      + '. The pool water is rendering an UNVERIFIED surface. Re-anchor applyPoolShader().');
    mat.userData.poolShaderAnchorsOk = false;
    mat.userData.poolShaderMisses = misses;
  }
}

/** Push the ripple clock to every LIVE cave's water material. Called from `updateCaveAtmosphere`
 *  (the per-frame, pause-gated, cave-scoped tick). O(live materials × their programs) — bounded by
 *  CAVE_RESIDENT_MAX × WATER_SHADER_CAP, i.e. ≤12 uniform writes for the whole world, and an evicted
 *  cave's entry is gone (not merely stale) because `releaseCavePoolMaterial` unregisters it. */
export function updateCavePoolWater(elapsed: number): void {
  for (const st of _liveMaterials.values()) {
    for (const s of st.shaders) {
      const t = s.uniforms.uPoolTime;
      if (t) t.value = elapsed;
    }
  }
}

const _sm01 = (x: number): number => {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};

/** CPU twins of the fragment shader's `poolHash` / `poolNoise` — the SAME expressions, evaluated at
 *  the SAME precision.
 *
 *  WHY A SECOND COPY EXISTS AT ALL (round-12, the phantom-refill fix). The visible waterline is not a
 *  ring — it is `depth + noise > 0`, evaluated per fragment. If the interaction raycast asked a
 *  DIFFERENT question (a radius, a padded disc, a distance fudge) the two would drift apart the first
 *  time the shore gradient or the jitter amplitude is retuned, and the prompt would go back to
 *  hovering over dry rock. So the CPU asks the same question with the same numbers, out of the same
 *  tuning constants.
 *
 *  WHY EVERY INTERMEDIATE IS `Math.fround`ed (round-13, sev-2 — the comment this replaces was WRONG).
 *  The old twin ran in float64 and claimed the residual was "~1e-4 m". It is not, and cannot be: this
 *  hash ends in `fract((qx+qy)*qz)`, and at cave world coordinates (130-260m from origin, ×4.2 1/m
 *  for the jitter octave) the argument of that final `fract` runs to 1e3-1e4, where a float32 ULP is
 *  already ~1e-3. Past that point the two precisions do not agree to a fraction of a hash cell — they
 *  DECORRELATE (the round-13 code review measured mean |Δhash| ≈ 0.2, a fifth of the hash's full
 *  range). `Math.fround` on every intermediate, in the GLSL's own op order, removes that class.
 *  END-TO-END EFFECT, measured against the GPU's own rendered waterline (`pool-fill` leg 4b, seed
 *  1337, 8 bearings): float64 twin meanAbs 0.148m / maxAbs 0.380m → float32 twin 0.135m / 0.360m.
 *  So the fix is real but SMALL, and the honest conclusion is the one below: the precision was never
 *  the dominant term — the interpolation is. What the fix removes is the UNBOUNDED part (a hash that
 *  decorrelates further the further the cave is from the origin); what remains is bounded by the
 *  mesh's own tessellation.
 *
 *  WHAT REMAINS (the honest residual — see also the note on `waterDepthAt`):
 *    · the GPU reads `vPoolD`, a BARYCENTRICALLY INTERPOLATED per-vertex `aPoolDepth`, while the CPU
 *      samples `floorH` exactly at the query point. Across a triangle (≈0.18m tangentially at
 *      EDGE_SEGS 88) the floor's ±7.5cm micro-relief is a straight line to the GPU and a curve to the
 *      CPU: a few cm of depth, which over the ~0.11 m/m shore gradient is DECIMETRES of lateral
 *      waterline. This is the dominant term and it is structural, not a rounding artefact.
 *    · driver freedom inside `fract`, `mix` (spec: `x*(1-a)+y*a`; some drivers use `x+a*(y-x)`) and
 *      FMA contraction in `dot`. Sub-ULP each, but non-zero.
 *  `pool-fill` leg 4b MEASURES the total against GPU truth (an A/B readPixels mask of the actual
 *  rendered waterline) rather than asserting it — see the tolerance there.
 *  KEEP IN SYNC with the GLSL in `applyPoolShader`. */
const _f = Math.fround;
/** GLSL `fract` in float32: x - floor(x) (never negative, unlike JS `%`). */
const _fr32 = (x: number): number => _f(x - Math.floor(x));
const _poolHash = (px: number, py: number): number => {
  // vec3 q = fract(vec3(p.xyx) * 0.1031);
  const C = _f(0.1031), K = _f(33.33);
  let qx = _fr32(_f(px * C)), qy = _fr32(_f(py * C)), qz = _fr32(_f(px * C));
  // q += dot(q, q.yzx + 33.33);
  const dp = _f(_f(_f(qx * _f(qy + K)) + _f(qy * _f(qz + K))) + _f(qz * _f(qx + K)));
  qx = _f(qx + dp); qy = _f(qy + dp); qz = _f(qz + dp);
  // return fract((q.x + q.y) * q.z);
  return _fr32(_f(_f(qx + qy) * qz));
};
/** GLSL `mix(x, y, a)` per spec — `x*(1-a) + y*a`, in float32. */
const _mix32 = (x: number, y: number, a: number): number => _f(_f(x * _f(1 - a)) + _f(y * a));
const _poolNoise = (px: number, py: number): number => {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = _f(px - ix), fy = _f(py - iy);
  const ux = _f(_f(fx * fx) * _f(3 - _f(2 * fx))), uy = _f(_f(fy * fy) * _f(3 - _f(2 * fy)));
  const a = _poolHash(ix, iy), b = _poolHash(_f(ix + 1), iy);
  const c = _poolHash(ix, _f(iy + 1)), d = _poolHash(_f(ix + 1), _f(iy + 1));
  return _mix32(_mix32(a, b, ux), _mix32(c, d, ux), uy);
};

/** A sampler for the REAL height of the cave floor rock at (x, z) — see `makeFloorSampler`. */
export type FloorHeight = (x: number, z: number) => number;

/** Build a floor-height sampler for a set of pools straight out of the SDF surface's vertices.
 *
 *  WHY THIS EXISTS. The water's whole shoreline read depends on knowing where the STONE is, not
 *  where the nominal floor PLANE is. `caveSdf` attenuates its big rock displacement to zero at the
 *  floor so chambers stay walkable, but it deliberately leaves ±`CAVE_SDF_MICRO_AMP` (7.5cm) of
 *  un-attenuated micro-relief so a flat floor still reads as rock. That 15cm band is the entire
 *  difference between "a disc of water lying on the floor" and "water that has found the low spots
 *  and left gravel standing out of it". Round 4 tried to get it for free by sinking the mesh below
 *  the floor plane and letting the depth test bury it — but a mesh floating up to 7.5cm over stone
 *  surfaces in flat lit facets wherever the rock happens to be low, which is exactly what the shore
 *  shot showed. Measuring the rock removes the guess.
 *
 *  HOW. One linear pass over the SDF surface's positions (it is already built and in hand at the
 *  call site), max-splatting floor-band vertices into a per-pool grid at the polygonization spacing,
 *  then bilinear sampling. Cost is ~1ms once per cave build, no raycasts, no BVH, and it is exactly
 *  as deterministic as the mesh it reads. */
/** Wall-clock cost of the last `makeFloorSampler` build, ms. Reported by the cave probe: this is the
 *  one linear pass this feature adds to the ATOMIC dress stage, so it is measured rather than assumed
 *  (the cycle-5 lesson — the cave build's hitch budget is spent in whole passes, not in guesses). */
export let lastFloorSamplerMs = 0;

export function makeFloorSampler(
  geometry: THREE.BufferGeometry,
  specs: CavePoolSpec[],
): FloorHeight {
  const t0 = performance.now();
  const CELL = Tuning.CAVE_SDF_VOXEL;                                  // match the mesh's own spacing
  type Grid = { x0: number; z0: number; nx: number; nz: number; base: number; h: Float32Array };
  const grids: Grid[] = specs.map((s) => {
    const reach = s.radius * (1 + Tuning.CAVE_POOL_EDGE_WOBBLE) + Tuning.CAVE_POOL_SHORE_M + 1.2;
    const n = Math.ceil((reach * 2) / CELL) + 2;
    const base = s.waterY - Tuning.CAVE_POOL_DEPTH_M;
    return { x0: s.x - reach - CELL, z0: s.z - reach - CELL, nx: n, nz: n, base, h: new Float32Array(n * n).fill(-Infinity) };
  });
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = pos.array as ArrayLike<number>;
  for (let i = 0, n = pos.count * 3; i < n; i += 3) {
    const x = arr[i], y = arr[i + 1], z = arr[i + 2];
    for (let gi = 0; gi < grids.length; gi++) {
      const g = grids[gi];
      // Only FLOOR-band vertices: the same column carries the ceiling and the walls, and a ceiling
      // vertex max-splatted into the grid would put the "floor" five metres up.
      if (y < g.base - 0.55 || y > g.base + 0.55) continue;
      const cx = Math.floor((x - g.x0) / CELL), cz = Math.floor((z - g.z0) / CELL);
      if (cx < 0 || cz < 0 || cx >= g.nx || cz >= g.nz) continue;
      const o = cz * g.nx + cx;
      if (y > g.h[o]) g.h[o] = y;
    }
  }
  for (const g of grids) for (let i = 0; i < g.h.length; i++) if (g.h[i] === -Infinity) g.h[i] = g.base;
  lastFloorSamplerMs = +(performance.now() - t0).toFixed(2);
  return (x: number, z: number): number => {
    let best = Number.NaN, bestD = Infinity;
    for (const g of grids) {
      const fx = (x - g.x0) / CELL, fz = (z - g.z0) / CELL;
      if (fx < 0 || fz < 0 || fx >= g.nx - 1 || fz >= g.nz - 1) continue;
      const d = Math.abs(fx - g.nx * 0.5) + Math.abs(fz - g.nz * 0.5);
      if (d >= bestD) continue;
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
      const o = iz * g.nx + ix;
      const h = (g.h[o] * (1 - tx) + g.h[o + 1] * tx) * (1 - tz)
              + (g.h[o + g.nx] * (1 - tx) + g.h[o + g.nx + 1] * tx) * tz;
      // A max-splat over a whole cell biases HIGH; a high estimate would eat real water (the shader
      // discards where depth ≤ 0), so bias back down by half the micro-relief amplitude.
      best = h - Tuning.CAVE_POOL_FLOOR_BIAS; bestD = d;
    }
    return best;
  };
}

/** The water surface for one pool.
 *
 *  NOT a flat disc. A flat sheet at a constant y over a floor that never rises to meet it can only
 *  end at a machined edge — that is exactly why the placeholder read as an ice disc dropped on the
 *  floor. Instead the surface SHELVES: full `CAVE_POOL_DEPTH_M` across the inner `SHELF_FRAC`, ramping
 *  up to a `FILM_M`-thin sheet at the wobbled rim, held as that film for `SHORE_M` more metres, then
 *  sinking `DROWN_M` below the floor plane.
 *
 *  The depth baked per vertex is measured against the REAL ROCK (`floorH`), not against the nominal
 *  floor plane, and the shader discards any fragment whose depth has gone to zero. So the WATERLINE
 *  IS CUT BY THE STONE: the lens crosses the floor's micro-relief in a jagged organic contour, gravel
 *  stands proud of the water, and the last hand's-width is a damp film clinging to the rock between
 *  the bumps — the wet rim, with no decal, no second mesh and nothing floating. (`floorH` returns NaN
 *  outside the sampled grids and the builder falls back to the flat plane; a pool that somehow got no
 *  vertices still renders, just with the old soft edge.)
 *
 *  WORLD space (the cave group carries an identity transform). NO COLLIDER — see the header.
 *
 *  `material` is THIS CAVE's instance (`createCavePoolMaterial`), never a module-shared one: the
 *  mirrored-emitter uniforms it carries are this cave's fungi. */
export function buildPoolWaterMesh(
  spec: CavePoolSpec,
  cnoise: Noise3,
  floorH: FloorHeight | undefined,
  material: THREE.Material,
): THREE.Mesh {
  const T = Tuning;
  const SEG = T.CAVE_POOL_EDGE_SEGS;
  const D = T.CAVE_POOL_DEPTH_M;
  const FILM = T.CAVE_POOL_FILM_M;

  // Radial ring schedule. The inner bands are relative to the (wobbled) rim radius; the outer bands
  // are ABSOLUTE metres past it, because a shoreline's damp band is a property of the stone, not of
  // how big the pool is — scaling it with radius made a 5m hall pool grow a 1.5m beach.
  const INNER = [0.00, 0.26, 0.44, 0.58, 0.70, 0.79, 0.86, 0.91, 0.945, 0.975, 1.00];
  const OUTER = [0.05, 0.11, 0.18, 0.26, 0.35, 0.45, 0.56, 0.68, 0.80, 0.94, 1.10];   // metres past the rim
  const NR = INNER.length + OUTER.length;                     // rings, excluding the centre vertex

  // Water depth (m) at a normalised inner radius t ∈ [0,1].
  const depthInner = (t: number): number =>
    FILM + (D - FILM) * (1 - _sm01((t - T.CAVE_POOL_SHELF_FRAC) / (1 - T.CAVE_POOL_SHELF_FRAC)));
  // …and at `s` metres past the rim. THE GRADIENT HERE IS THE WHOLE SHORELINE. Round 6 dropped the
  // skirt at ~0.8 m/m, which meant the ±7.5cm of floor micro-relief could only move the waterline by
  // ~9cm — so the contour hugged the mesh's own ring and read as a scalloped polygon no matter how
  // much edge jitter went on top. Across SHORE_M the surface now falls at ~0.11 m/m, an order of
  // magnitude gentler, so the SAME relief swings the waterline by the better part of a metre and the
  // rock genuinely decides where the water stops. Past the shore it drops hard, to guarantee the
  // sheet is under the stone (and discarded) rather than wandering off across the chamber.
  const SH = T.CAVE_POOL_SHORE_M;
  const depthOuter = (s: number): number =>
    FILM - (FILM + T.CAVE_POOL_SHORE_FALL) * Math.min(1, s / SH)
    - T.CAVE_POOL_DROWN_M * _sm01((s - SH) / (SH * 0.45));

  // Rim radius along a bearing — two octaves of world-space noise, so neighbouring pools never share
  // a shape. Hoisted out of the vertex loop because the RAYCAST needs the identical function: see
  // `waterDepthAt` below, which is the one definition of "is there water here" that both the CPU
  // interaction path and the baked GPU attribute are derived from.
  const rimAt = (ca: number, sa: number): number => {
    const w = 1 + (cnoise(spec.x * 0.3 + ca * 2.1, 11.3, spec.z * 0.3 + sa * 2.1) * 0.7
                 + cnoise(spec.x * 0.3 + ca * 5.3, 4.9, spec.z * 0.3 + sa * 5.3) * 0.3) * T.CAVE_POOL_EDGE_WOBBLE;
    return spec.radius * w;
  };

  const count = 1 + SEG * NR;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const dep = new Float32Array(count);
  const floorY = spec.waterY - D;

  pos[0] = spec.x; pos[1] = spec.waterY; pos[2] = spec.z;
  nor[1] = 1;
  {
    const rock0 = floorH ? floorH(spec.x, spec.z) : Number.NaN;
    dep[0] = Number.isFinite(rock0) ? spec.waterY - rock0 : D;
  }

  let v = 1;
  for (let ring = 0; ring < NR; ring++) {
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rRim = rimAt(ca, sa);
      let r: number, d: number;
      if (ring < INNER.length) { const t = INNER[ring]; r = rRim * t; d = depthInner(t); }
      else { const s = OUTER[ring - INNER.length]; r = rRim + s; d = depthOuter(s); }
      const px = spec.x + ca * r, pz = spec.z + sa * r;
      const surfY = floorY + d;
      // Depth against the ROCK, not the plane — this is what cuts the waterline on the stone.
      const rock = floorH ? floorH(px, pz) : Number.NaN;
      // ── THE DAMP-COLLAR LIFT (round-12 finding 5). Past the waterline the skirt no longer just
      //    sinks under the stone to be depth-tested away: for CAVE_POOL_WET_BAND_M it renders as a
      //    dark glossy film ON the rock, which is what wet stone looks like. For that film to be
      //    visible it must sit slightly PROUD of the surface it is wetting — WET_LIFT_M above the
      //    SAMPLED rock height (which is itself biased low by FLOOR_BIAS, hence the lift must exceed
      //    it). The DEPTH attribute is deliberately left as the TRUE, unlifted signed depth: the
      //    lift is a rendering necessity, the depth is the optical model, and conflating them is
      //    what would put water where there is only damp stone. Inside the pool this clamp can never
      //    fire (the surface is 0.26m up and the floor carries only ±0.075m of relief), so the water
      //    plane itself stays exactly flat.
      const lifted = Number.isFinite(rock) ? Math.max(surfY, rock + T.CAVE_POOL_WET_LIFT_M) : surfY;
      const o = v * 3;
      pos[o] = px; pos[o + 1] = lifted; pos[o + 2] = pz;
      nor[o + 1] = 1;
      dep[v] = Number.isFinite(rock) ? surfY - rock : d;
      v++;
    }
  }

  const idx: number[] = [];
  for (let i = 0; i < SEG; i++) idx.push(0, 1 + ((i + 1) % SEG), 1 + i);   // the centre fan
  for (let ring = 0; ring < NR - 1; ring++) {
    const a0 = 1 + ring * SEG, b0 = 1 + (ring + 1) * SEG;
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      idx.push(a0 + i, a0 + j, b0 + j);
      idx.push(a0 + i, b0 + j, b0 + i);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aPoolDepth', new THREE.BufferAttribute(dep, 1));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'cavePoolWater';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // Render after the opaque cave surface so the transparent sheet blends over the floor beneath it.
  mesh.renderOrder = 2;

  // ── ONE SOURCE OF TRUTH FOR "WHERE THE WATER IS" (round-12 code critique, sev-2).
  //    The mesh extends 1.10m past the nominal rim (the OUTER ring schedule) and the FRAGMENT shader
  //    is what decides that most of that skirt is not water — it discards where the measured depth
  //    reaches zero. `interaction.ts` raycasts the whole mesh with no knowledge of that discard, so
  //    the r11 build offered "[E] refill" from up to ~1.6m out, standing on visibly dry rock. The
  //    prompt was reading a triangle the player cannot see.
  //    The fix is not a shrunken collider or a distance fudge — either would drift out of step with
  //    the shader the first time the shore gradient is retuned. It is to make the CPU ask the SAME
  //    question the GPU asks, from the SAME data: sample the floor height under the hit point and
  //    reject the hit if the water depth there is not positive. `floorH` is the very sampler whose
  //    output was baked into `aPoolDepth`.
  //
  //    THE TWO ARE NOT IDENTICAL, AND THIS IS WHERE THEY DIFFER (round-13, sev-2 — the previous
  //    comment claimed "the two can never disagree by construction", which is false and made the
  //    residual un-budgeted). The GPU does not evaluate `floorH`: it reads `vPoolD`, the
  //    barycentric interpolation of the per-vertex `aPoolDepth` that `floorH` produced at the
  //    VERTICES. Between vertices (≈0.18m tangentially at EDGE_SEGS 88) the floor's ±7.5cm
  //    micro-relief is a plane to the GPU and a curve to the CPU, and over the ~0.11 m/m shore
  //    gradient a couple of cm of depth is decimetres of lateral waterline. The noise octaves below
  //    now agree to float32 (see `_poolHash`), so this interpolation term is the whole disagreement.
  //    It is MEASURED, not assumed: `pool-fill` leg 4b unprojects the GPU's own rendered waterline
  //    (an A/B readPixels mask) on 8 bearings and asserts this predicate tracks it within a stated,
  //    measured tolerance. Retune the shore gradient or the ring schedule and that leg moves first.
  //    (No `floorH` — the pure-placement path — means no depth signal at all, and the mesh keeps
  //    stock raycast behaviour rather than silently becoming un-interactable.)
  if (floorH) {
    const T2 = Tuning;
    // The SAME predicate the fragment shader evaluates: the ideal (unlifted) surface height from the
    // ring schedule, minus the sampled rock, plus the two noise octaves that ravel the contour.
    // The noise DOMAIN is built in float32 the way the shader builds it (`vPoolW.xz * uPoolEdge*`),
    // so the twin sees the same hash cell the fragment does.
    const nz = (x: number, z: number, freq: number): number => _poolNoise(_f(_f(x) * _f(freq)), _f(_f(z) * _f(freq)));
    const waterDepthAt = (x: number, z: number): number => {
      const dx = x - spec.x, dz = z - spec.z;
      const rr = Math.hypot(dx, dz);
      const ca = rr > 1e-6 ? dx / rr : 1, sa = rr > 1e-6 ? dz / rr : 0;
      const rRim = rimAt(ca, sa);
      const d = rr <= rRim ? depthInner(rRim > 1e-6 ? rr / rRim : 0) : depthOuter(rr - rRim);
      const rock = floorH(x, z);
      if (!Number.isFinite(rock)) return Number.NaN;
      const dep0 = (floorY + d) - rock;
      const lobe = (nz(x, z, T2.CAVE_POOL_EDGE_LOBE_FREQ) - 0.5) * 2.0
                 + (nz(x, z, T2.CAVE_POOL_EDGE_LOBE_FREQ * 2.3) - 0.5) * 0.9;
      const jn = (nz(x, z, T2.CAVE_POOL_EDGE_JITTER_FREQ) - 0.5) * 1.0
               + (nz(x, z, T2.CAVE_POOL_EDGE_JITTER_FREQ * 4.5) - 0.5) * 0.45;
      return dep0 + lobe * T2.CAVE_POOL_EDGE_LOBE
           + jn * T2.CAVE_POOL_EDGE_JITTER * (1 - _sm01(Math.abs(dep0) / (T2.CAVE_POOL_EDGE_JITTER * 3)));
    };
    const base = THREE.Mesh.prototype.raycast;
    mesh.raycast = function poolRaycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
      const start = intersects.length;
      base.call(this, raycaster, intersects);
      for (let i = intersects.length - 1; i >= start; i--) {
        const p = intersects[i].point;
        const dw = waterDepthAt(p.x, p.z);
        if (!(dw > 0)) intersects.splice(i, 1);       // NaN-safe: no depth signal ⇒ not water
      }
    };
    mesh.userData.poolWaterDepthAt = waterDepthAt;    // the probe's negative assertion reads this
  }
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

/** What one cave's pools are: the records, plus THE CAVE'S OWN water material. */
export interface CavePoolBuild {
  pools: CavePool[];
  /** This cave's material instance (null if the cave placed no pools). The caller must publish this
   *  cave's emitters into it (`setCavePoolEmitters`) and it is disposed at eviction
   *  (`releaseCavePoolMaterial`, driven off the pool meshes in caveStream's dispose path). */
  material: THREE.MeshStandardMaterial | null;
}

/** Build every pool for a generated cave. The caller adds the meshes to the cave group (so eviction
 *  disposes them with everything else) and publishes `source` into `ctx.waterSources.list`.
 *  `sdfGeometry` is the finished cave surface — the water reads the REAL rock height out of it so its
 *  shoreline is cut by the stone (see `makeFloorSampler`). Optional so the pure placement path and any
 *  future caller without a mesh in hand still work; without it the rim falls back to a soft edge. */
export function buildCavePools(
  graph: CaveGraph,
  cnoise: Noise3,
  rand: () => number,
  dirsByNode: Map<number, Array<{ x: number; z: number }>>,
  sdfGeometry?: THREE.BufferGeometry,
): CavePoolBuild {
  const out: CavePool[] = [];
  const specs = placeCavePools(graph, cnoise, rand, dirsByNode);
  if (!specs.length) return { pools: out, material: null };
  const floorH = sdfGeometry ? makeFloorSampler(sdfGeometry, specs) : undefined;
  // ONE instance for THIS cave, shared by its own pools (they mirror the same fungi) and by nothing
  // else in the world — see the `PoolMatState` block for why that matters.
  const material = createCavePoolMaterial();
  for (const spec of specs) {
    const mesh = buildPoolWaterMesh(spec, cnoise, floorH, material);
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
  return { pools: out, material };
}
