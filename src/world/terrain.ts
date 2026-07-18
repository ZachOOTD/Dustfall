// Dune terrain: layered simplex heightmap mesh + matching Rapier heightfield.
// Both share the same heights array — the visual mesh and the collider are
// generated from identical samples so they overlay exactly.
//
// Session EE — world rework #1. Replaced the single 800m heightfield with a
// grid of TERRAIN_CHUNK_SIZE-meter chunks (192 cells each so per-chunk
// fidelity is unchanged). Seam invisibility: ALL chunks share one
// `createNoise2D` instance AND sample world-space (x, z) — adjacent chunks
// at their shared edge sample identical coords, producing bit-identical
// heights and zero visible seams.
//
// Infinite Sands S1 (campaign 2026-07-10) — the grid now STREAMS: tiles are
// keyed by integer tile coords (tx, tz) in an unbounded grid (center =
// tx*SIZE, tz*SIZE) and a (2*TERRAIN_TILE_RADIUS+1)² ring follows the
// player via recenter(). Tiles beyond RADIUS+1 are disposed (geometry +
// Rapier body). The initial ring around (0,0) is byte-identical to the old
// fixed 3×3 grid, so the released escape-pod intro region is unchanged.
// Determinism: tile content is a pure function of world-space (x, z)
// through the shared noise instance — a re-entered tile regenerates
// identically. heightAt falls back to the closed-form sample outside
// loaded tiles so procgen can query anywhere in the infinite field.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { BiomeSampler } from './biomes.ts';
import { Tuning } from '../config/tuning.ts';
import { createTerrainMaterial } from './terrainMaterial.ts';

// Per-biome ground colors (Session P). Punchier than first-pass so the
// regions read clearly from a distance: dune = saturated orange-sand,
// rocky = dark red-brown, salt = bright warm-white.
const BIOME_COLOR_DUNE: readonly [number, number, number] = [0xcd / 255, 0x95 / 255, 0x55 / 255];
const BIOME_COLOR_ROCKY: readonly [number, number, number] = [0x55 / 255, 0x36 / 255, 0x1f / 255];
const BIOME_COLOR_SALT: readonly [number, number, number] = [0xf0 / 255, 0xe8 / 255, 0xd2 / 255];
// Cycle 8 (ACAQ) — wreck-yard graveyard ground: ashen oxidized grey-brown
// (rust-stained, drained of the warm dune orange). Reads as a different, dead place.
const BIOME_COLOR_WRECK_YARD: readonly [number, number, number] = [0x47 / 255, 0x3a / 255, 0x2e / 255];
// ACAS A3 — graveyard-floor mottle: oil-stained pools (dark) + bleached-ash drifts
// (pale), noise-blended over the ashen base so the dead ground reads contaminated
// and textured rather than a flat muddy tint.
const BIOME_COLOR_WRECK_YARD_OIL: readonly [number, number, number] = [0x26 / 255, 0x20 / 255, 0x1b / 255];
const BIOME_COLOR_WRECK_YARD_ASH: readonly [number, number, number] = [0x71 / 255, 0x64 / 255, 0x52 / 255];
// bone_field — a titan graveyard: a BOLD bleached bone-white ground that
// contrasts hard against the warm-tan desert (this is the POP — the reverted
// ash_barren failed for being a mere dark tint). Cooler + paler than the salt
// flat (which is a warm 0xf0e8d2) so it reads as bleached BONE, not salt: a
// near-white cool ivory, with a duller dried-marrow / dust-in-the-cracks mottle
// so it reads organic + textured rather than a flat mineral white.
// Cool bleached-pan ivory (faintly cool so it separates from the WARM tan dunes
// under the game's warm sun — a warm ivory just reads as more desert). The mottle
// is a neutral dried-marrow grey, NOT warm tan (a warm mottle pulls the pan back
// toward desert — the ash/first-bone failure).
const BIOME_COLOR_BONE_FIELD: readonly [number, number, number] = [0xed / 255, 0xf0 / 255, 0xf1 / 255];
const BIOME_COLOR_BONE_FIELD_MARROW: readonly [number, number, number] = [0xc9 / 255, 0xc7 / 255, 0xbf / 255];
// ACAR2 — Sarlacc crater interior: a shadowed dusky dune-brown so the recessed
// funnel reads as a pit (darkest at center, fading to dune at the rim).
const BIOME_COLOR_SARLACC_PIT: readonly [number, number, number] = [0x5a / 255, 0x44 / 255, 0x30 / 255];
// M8 ⑨ (C47) — the deep-cave MOUTH reads DARKER than the Sarlacc pit (a shadowed descent into
// the earth, not just a sand bowl): a near-black shadowed brown, deepening to the center.
const BIOME_COLOR_CAVE_MOUTH: readonly [number, number, number] = [0x24 / 255, 0x1d / 255, 0x16 / 255];
// The Deep Desert — the erg (mega dune-sea) is clean WIND-BLOWN sand: a bright,
// faintly warmer dune tone so the sea reads as pristine drifting sand (the
// underlying biome-noise color — which could stray to rocky-brown or salt-white
// in patches — is overridden toward this so the dune sea stays coherent).
const BIOME_COLOR_ERG: readonly [number, number, number] = [0xd8 / 255, 0xa2 / 255, 0x60 / 255];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Smooth biome-to-height-scale lookup. Mirrors the color blend so the height
// transitions match the visual transitions exactly.
function biomeHeightScale(noiseVal: number): number {
  const rockyT = Tuning.BIOME_THRESHOLD_ROCKY;
  const saltT = Tuning.BIOME_THRESHOLD_SALT;
  const W = _BIOME_BLEND_WIDTH;
  if (noiseVal < rockyT - W) return Tuning.BIOME_HEIGHT_SCALE_ROCKY;
  if (noiseVal < rockyT + W) {
    const t = smoothstep(rockyT - W, rockyT + W, noiseVal);
    return Tuning.BIOME_HEIGHT_SCALE_ROCKY +
      (Tuning.BIOME_HEIGHT_SCALE_DUNE - Tuning.BIOME_HEIGHT_SCALE_ROCKY) * t;
  }
  if (noiseVal < saltT - W) return Tuning.BIOME_HEIGHT_SCALE_DUNE;
  if (noiseVal < saltT + W) {
    const t = smoothstep(saltT - W, saltT + W, noiseVal);
    return Tuning.BIOME_HEIGHT_SCALE_DUNE +
      (Tuning.BIOME_HEIGHT_SCALE_SALT - Tuning.BIOME_HEIGHT_SCALE_DUNE) * t;
  }
  return Tuning.BIOME_HEIGHT_SCALE_SALT;
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

const _BIOME_BLEND_WIDTH = 0.22;
function blendedBiomeColor(noiseVal: number): [number, number, number] {
  const rockyT = Tuning.BIOME_THRESHOLD_ROCKY;
  const saltT = Tuning.BIOME_THRESHOLD_SALT;
  if (noiseVal < rockyT - _BIOME_BLEND_WIDTH) return [...BIOME_COLOR_ROCKY];
  if (noiseVal < rockyT + _BIOME_BLEND_WIDTH) {
    const t = smoothstep(rockyT - _BIOME_BLEND_WIDTH, rockyT + _BIOME_BLEND_WIDTH, noiseVal);
    return lerp3(BIOME_COLOR_ROCKY, BIOME_COLOR_DUNE, t);
  }
  if (noiseVal < saltT - _BIOME_BLEND_WIDTH) return [...BIOME_COLOR_DUNE];
  if (noiseVal < saltT + _BIOME_BLEND_WIDTH) {
    const t = smoothstep(saltT - _BIOME_BLEND_WIDTH, saltT + _BIOME_BLEND_WIDTH, noiseVal);
    return lerp3(BIOME_COLOR_DUNE, BIOME_COLOR_SALT, t);
  }
  return [...BIOME_COLOR_SALT];
}

interface Tile {
  /** World-space center of this tile (Y = 0). */
  centerX: number;
  centerZ: number;
  /** Heights at each vertex, indexed [i*(CELLS+1)+j]. */
  heights: Float32Array;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
}

export interface Terrain {
  /** Live array — one mesh per LOADED tile (mutates as tiles stream). */
  meshes: THREE.Mesh[];
  /** Shared simplex-noise instance — exposed so procgen can sample
   *  identical world heights without seams. */
  noise: (x: number, y: number) => number;
  /** Terrain height at world (x, z). Bilinear over the baked heightfield
   *  inside loaded tiles (exactly matches the collider); the closed-form
   *  sample everywhere else — so it answers at ANY coordinate. */
  heightAt: (x: number, z: number) => number;
  /** D299 — the CLOSED-FORM height only, independent of tile-load state.
   *  Chunk DESCRIPTORS must gate on this (bilinear-vs-formula differences
   *  would make a descriptor depend on what happens to be loaded). */
  pureHeightAt: (x: number, z: number) => number;
  /** Approximate normal at world (x, z) using neighboring samples. */
  normalAt: (x: number, z: number) => THREE.Vector3;
  /** The SHARED ground material (one instance, every tile). Exposed so
   *  terrain-conforming decor (e.g. the leviathan entrance sand drift) can
   *  render with the EXACT same shader/lighting/fog as the ground — one
   *  source of truth, so a re-skinned mound is indistinguishable from the
   *  terrain it sits on. Consumers must feed it per-vertex `color` +
   *  `aBiomeRaw` attributes (see groundSample) and must NOT route the mesh
   *  through mergeStaticByMaterial (it strips those attributes). */
  groundMaterial: THREE.MeshLambertMaterial;
  /** The EXACT per-vertex ground color + biome-raw noise the tiles bake at
   *  world (x, z) — same blend + wreck-yard/bone/pit/cave overlays fillRows
   *  uses. Lets terrain-matching decor sample the LOCAL ground color at its
   *  own site so it matches ITS surroundings, not a global average. */
  groundSample: (x: number, z: number) => { color: [number, number, number]; biomeRaw: number };
  /** Infinite Sands S1 — keep the tile ring centered on (px, pz). Builds
   *  missing tiles (the player's own tile immediately, the rest budgeted
   *  one per call) and disposes tiles beyond RADIUS+1. Call per-frame. */
  recenter: (px: number, pz: number) => void;
  /** Loaded tile keys ("tx,tz") — for the streaming probe / debug. */
  tileKeys: () => string[];
  /** S6 — generation-perf counters (max wall-clock per sync build / slice
   *  step / stage). Drives the chunk-perf gate. */
  perfStats: () => {
    syncBuilds: number; maxSyncMs: number;
    sliceSteps: number; maxSliceMs: number;
    maxStageMs: { fill: number; geometry: number; finalize: number };
  };
  resetPerf: () => void;
  /** Legacy half-extent of the ORIGINAL fixed grid (kept for consumers
   *  that still reason about the authored origin region). */
  worldHalfSize: number;
}

export function createTerrain(
  scene: THREE.Scene,
  world: RAPIER.World,
  rand: Rng,
  biomes: BiomeSampler,
): Terrain {
  const noise = createNoise2D(rand);

  const SIZE = Tuning.TERRAIN_CHUNK_SIZE;
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const RADIUS = Tuning.TERRAIN_TILE_RADIUS;
  const stride = CELLS + 1;
  const worldHalfSize = (SIZE * (2 * RADIUS + 1)) * 0.5;

  // One shared material for every tile. Sharing matters for streaming:
  // createTerrainMaterial registers its compiled shader in a module-level
  // Set for per-frame uniform updates (terrainMaterial.ts _shaderRefs) and
  // there is no unregister — a material per streamed tile would leak a
  // shader ref on every tile ever built. One material = one ref, ever,
  // and one shader compile instead of one per tile.
  const material = createTerrainMaterial();

  // Closed-form height at world (x, z): dune formula × biome flatness,
  // minus the authored crater carves. This is the SINGLE height function —
  // tile baking samples it per-vertex, and heightAt falls back to it
  // outside loaded tiles, so baked and computed heights always agree.
  const computeHeightAt = (x: number, z: number): number => {
    let flatness = biomeHeightScale(biomes.rawAt(x, z));
    const wyH = biomes.wreckYardAt(x, z);   // Cycle 8 — flatten the graveyard floor
    if (wyH > 0) flatness = flatness * (1 - wyH) + Tuning.WRECK_YARD_HEIGHT_SCALE * wyH;
    const boneH = biomes.boneFieldAt(x, z);  // bone_field — a gentle graveyard basin
    if (boneH > 0) flatness = flatness * (1 - boneH) + Tuning.BONE_FIELD_HEIGHT_SCALE * boneH;
    const pitH = biomes.sarlaccPitAt(x, z);  // ACAR — flatten a sand bowl around the maw
    if (pitH > 0) flatness = flatness * (1 - pitH) + 0.05 * pitH;
    let h = sampleHeight(noise, x, z) * flatness;
    // ACAR2 — carve the Sarlacc into a RECESSED funnel crater (Great Pit of
    // Carkoon), deepest at center, eased to 0 at the clearing rim. The depth
    // profile is a radial smoothstep on distance to the anchor: a soft sand
    // lip at the rim (no seam / normal flicker), a steep mid-wall, and a
    // flattened bottom where the maw mesh sits. Carved into the shared heights
    // array → the visual mesh, the Rapier heightfield collider, AND heightAt()
    // all dip together, so the player physically walks down into the bowl.
    {
      const pdx = x - biomes.sarlaccPitAnchor.x;
      const pdz = z - biomes.sarlaccPitAnchor.z;
      const pr = Math.sqrt(pdx * pdx + pdz * pdz);
      const R = Tuning.SARLACC_PIT_CLEARING;
      if (pr < R) {
        const t = 1 - pr / R;                 // 0 at rim → 1 at center
        const profile = t * t * (3 - 2 * t);  // smoothstep: soft lip + flat-ish floor
        h -= profile * Tuning.SARLACC_PIT_CRATER_DEPTH;
      }
    }
    // M8 ⑨ (C47) — carve the DEEP CAVE descent funnel (same recessed-funnel
    // technique: a soft lip at the rim, a steep mid-wall ~39° < the KCC climb
    // limit, a flat floor). This is the cave MOUTH the player walks down into;
    // the enclosed roofed interior is a separate module placed at the floor.
    {
      const cdx = x - biomes.caveAnchor.x;
      const cdz = z - biomes.caveAnchor.z;
      const cr = Math.sqrt(cdx * cdx + cdz * cdz);
      const CR = Tuning.CAVE_PIT_CLEARING;
      if (cr < CR) {
        const t = 1 - cr / CR;
        const profile = t * t * (3 - 2 * t);
        h -= profile * Tuning.CAVE_PIT_CRATER_DEPTH;
      }
    }
    // The Deep Desert — inside an erg region, blend the mega dune-sea heightfield
    // over the surrounding desert. The mask (0 outside → 1 in the core) crosses a
    // WIDE smoothstep border (ERG_CORE_FRAC → radius), so the seam slope stays
    // gentle even though the erg dunes tower ~50m above the base terrain. Pure:
    // ergInfoAt + sampleErgHeight are hash/noise-only (descriptor gates depend on it).
    const erg = biomes.ergInfoAt(x, z);
    if (erg) {
      const hErg = sampleErgHeight(noise, x, z, erg.windRad, erg.ox, erg.oz);
      h = h * (1 - erg.mask) + hErg * erg.mask;
    }
    return h;
  };

  // The EXACT per-vertex ground color at world (x, z) — the single source of
  // truth for both the tile fill (fillRows) and terrain-matching decor
  // (Terrain.groundSample). `n` is the raw biome noise at (x, z), passed in so
  // callers that already have it don't resample. Kept bit-identical to the
  // original inline fillRows block (a pure code-move — same ops, same order).
  const groundColorAt = (wx2: number, wz2: number, n: number): [number, number, number] => {
    let c = blendedBiomeColor(n);
    const wyC = biomes.wreckYardAt(wx2, wz2);   // Cycle 8 — tint toward the graveyard ground
    if (wyC > 0) {
      // ACAS A3 — mottle the graveyard floor with oil pools + ash drifts
      // (separate-phase noise) so it reads as a contaminated dead place.
      const mot = noise(wx2 * 0.05 + 11.3, wz2 * 0.05 - 7.1);   // -1..1
      const stain = mot < 0
        ? lerp3(BIOME_COLOR_WRECK_YARD, BIOME_COLOR_WRECK_YARD_OIL, Math.min(1, -mot))
        : lerp3(BIOME_COLOR_WRECK_YARD, BIOME_COLOR_WRECK_YARD_ASH, mot * 0.7);
      c = lerp3(c, stain, wyC);
    }
    // bone_field — bleach the ground to bone-white with a dried-marrow
    // mottle. A near-total overlay (0.92) so the PALE read dominates from
    // a distance; the mottle keeps it from going flat-mineral like salt.
    const boneC = biomes.boneFieldAt(wx2, wz2);
    if (boneC > 0) {
      const bmot = noise(wx2 * 0.05 + 12.3, wz2 * 0.05 - 4.1);     // -1..1 marrow/dust streaks
      const boneStain = lerp3(BIOME_COLOR_BONE_FIELD, BIOME_COLOR_BONE_FIELD_MARROW, Math.max(0, bmot) * 0.5);
      c = lerp3(c, boneStain, boneC * 0.96);
    }
    // ACAR2 — dusk the sand toward the Sarlacc crater center so the recessed
    // funnel READS as a shadowed pit even under flat overhead light.
    const pitC = biomes.sarlaccPitAt(wx2, wz2);
    if (pitC > 0) c = lerp3(c, BIOME_COLOR_SARLACC_PIT, pitC * 0.82);
    // M8 ⑨ — dusk the sand toward the cave mouth so the descent reads as a dark hole.
    const caveC = biomes.caveAt(wx2, wz2);
    if (caveC > 0) c = lerp3(c, BIOME_COLOR_CAVE_MOUTH, caveC * 0.9);
    // The Deep Desert — override the erg toward clean wind-blown sand so the dune
    // sea reads coherent (the base biome-noise color could stray rocky/salt).
    const ergC = biomes.ergAt(wx2, wz2);
    if (ergC > 0) c = lerp3(c, BIOME_COLOR_ERG, ergC * 0.9);
    return c;
  };

  const tiles = new Map<string, Tile>();
  const meshes: THREE.Mesh[] = [];
  const tileKey = (tx: number, tz: number): string => `${tx},${tz}`;

  // ── Infinite Sands S6 — STAGED tile builds. ONE shared per-vertex fill
  // (fillRows) serves both the SYNCHRONOUS path (the boot ring + the
  // anchor tile — fall-through protection; byte-identical to the pre-S6
  // build) and the SLICED background path (recenter advances a single
  // in-flight build by TERRAIN_SLICE_ROWS rows per frame, then assembles
  // geometry on one frame and finalizes mesh+collider ATOMICALLY on the
  // next — rule 9: the collider and the visible mesh appear together;
  // no partial tile is ever in the scene). The fill combines the old
  // heights pass + colors pass into one row sweep — every per-vertex
  // value is a pure function of world (x, z), so the output arrays are
  // byte-identical to the two-pass original. ──

  interface TileBuild {
    tx: number;
    tz: number;
    centerX: number;
    centerZ: number;
    heights: Float32Array;
    positions: Float32Array;
    colors: Float32Array;
    biomeRaws: Float32Array;
    /** Next i-row to fill; > CELLS = fill complete. */
    row: number;
    geo: THREE.BufferGeometry | null;
  }

  // Permanent generation-perf accounting (drives the S6 chunk-perf gate +
  // the F1 HUD if wired later). Wall-clock per recenter/build step.
  const _perf = {
    syncBuilds: 0,
    maxSyncMs: 0,
    sliceSteps: 0,
    maxSliceMs: 0,
    maxStageMs: { fill: 0, geometry: 0, finalize: 0 },
  };

  const newTileBuild = (tx: number, tz: number): TileBuild => {
    const vertCount = stride * stride;
    return {
      tx, tz,
      centerX: tx * SIZE,
      centerZ: tz * SIZE,
      heights: new Float32Array(vertCount),
      positions: new Float32Array(vertCount * 3),
      colors: new Float32Array(vertCount * 3),
      biomeRaws: new Float32Array(vertCount),
      row: 0,
      geo: null,
    };
  };

  /** Fill up to `rowBudget` i-rows (heights + positions + colors +
   *  biomeRaws in one sweep). Returns true when the fill is complete.
   *  World-space sampling — adjacent tiles' shared edge produces identical
   *  heights because both tiles pass the same world (x,z) through the SAME
   *  noise instance and biome sampler. */
  const fillRows = (b: TileBuild, rowBudget: number): boolean => {
    const end = Math.min(CELLS, b.row + rowBudget - 1);
    for (let i = b.row; i <= end; i++) {
      for (let j = 0; j <= CELLS; j++) {
        const localX = (i / CELLS - 0.5) * SIZE;
        const localZ = (j / CELLS - 0.5) * SIZE;
        const h = computeHeightAt(b.centerX + localX, b.centerZ + localZ);
        b.heights[i * stride + j] = h;
        const idx = (i * stride + j) * 3;
        b.positions[idx] = localX;
        b.positions[idx + 1] = h;
        b.positions[idx + 2] = localZ;
        const wx2 = b.centerX + localX, wz2 = b.centerZ + localZ;
        const n = biomes.rawAt(wx2, wz2);
        const c = groundColorAt(wx2, wz2, n);
        b.colors[idx]     = c[0];
        b.colors[idx + 1] = c[1];
        b.colors[idx + 2] = c[2];
        b.biomeRaws[i * stride + j] = n;
      }
    }
    b.row = end + 1;
    return b.row > CELLS;
  };

  // Index buffer is identical for every tile — build once, share.
  const _sharedIndices: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const a = i * stride + j;
      const b2 = a + 1;
      const c2 = (i + 1) * stride + j;
      const d = c2 + 1;
      _sharedIndices.push(a, b2, c2, b2, d, c2);
    }
  }

  const assembleGeometry = (b: TileBuild): void => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(b.colors, 3));
    // Custom per-vertex biome noise — read by terrainMaterial shader.
    geo.setAttribute('aBiomeRaw', new THREE.BufferAttribute(b.biomeRaws, 1));
    geo.setIndex(_sharedIndices);
    geo.computeVertexNormals();
    b.geo = geo;
  };

  const finalizeTile = (b: TileBuild): void => {
    // Session MM-2 — procedural detail via onBeforeCompile shader patches
    // (the shared `material` above). Vertex colors feed the base diffuse.
    const mesh = new THREE.Mesh(b.geo!, material);
    mesh.position.set(b.centerX, 0, b.centerZ);
    // Terrain never casts (it IS the shadow catcher). noShadow marks it so
    // the boot shadow-flag traverse in main.ts doesn't flip castShadow on.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    scene.add(mesh);
    // Rapier heightfield collider, body translated to tile center — added
    // in the SAME step as the mesh (atomic; rule 9).
    const colliderDesc = RAPIER.ColliderDesc.heightfield(
      CELLS, CELLS, b.heights,
      { x: SIZE, y: 1, z: SIZE },
    );
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(b.centerX, 0, b.centerZ),
    );
    world.createCollider(colliderDesc, body);
    tiles.set(tileKey(b.tx, b.tz), { centerX: b.centerX, centerZ: b.centerZ, heights: b.heights, mesh, body });
    meshes.push(mesh);
  };

  /** SYNCHRONOUS build — the boot ring + the anchor tile (a save-load
   *  teleport must never fall through unloaded ground). Same staged fns,
   *  run to completion in one call; byte-identical output. */
  const buildTile = (tx: number, tz: number): void => {
    const t0 = performance.now();
    const b = newTileBuild(tx, tz);
    fillRows(b, stride);
    assembleGeometry(b);
    finalizeTile(b);
    const ms = performance.now() - t0;
    _perf.syncBuilds++;
    if (ms > _perf.maxSyncMs) _perf.maxSyncMs = ms;
  };

  const disposeTile = (key: string): void => {
    const tile = tiles.get(key);
    if (!tile) return;
    tiles.delete(key);
    scene.remove(tile.mesh);
    tile.mesh.geometry.dispose();   // material is shared — never disposed
    const mi = meshes.indexOf(tile.mesh);
    if (mi >= 0) meshes.splice(mi, 1);
    // Removing the body drops its heightfield collider with it (rule 9 —
    // no orphaned colliders under vanished ground).
    world.removeRigidBody(tile.body);
  };

  // Initial ring around the origin — identical to the old fixed 3×3 grid
  // (centers at -800/0/+800), so the authored intro region boots unchanged.
  for (let tx = -RADIUS; tx <= RADIUS; tx++) {
    for (let tz = -RADIUS; tz <= RADIUS; tz++) {
      buildTile(tx, tz);
    }
  }

  // ANCHOR-MARGIN model (mirrors chunkManager): the tile ring centers on
  // an ANCHOR tile that only moves when the player walks more than
  // TERRAIN_ANCHOR_MARGIN_M past the anchor tile's edge. Straddling /
  // micro-sliding on a tile boundary therefore never flips the ring — no
  // 37k-vertex rebuild thrash — and a settled ring is always exactly the
  // (2*RADIUS+1)² set. Initial anchor = tile (0,0), matching the boot ring.
  let atx = 0;
  let atz = 0;
  // S6 — the single in-flight SLICED build (non-anchor ring tiles only).
  let pending: TileBuild | null = null;

  const recenter = (px: number, pz: number): void => {
    // Tiles are CENTER-aligned (span center ± SIZE/2).
    const margin = Tuning.TERRAIN_ANCHOR_MARGIN_M;
    const half = SIZE * 0.5;
    if (
      px < atx * SIZE - half - margin || px > atx * SIZE + half + margin ||
      pz < atz * SIZE - half - margin || pz > atz * SIZE + half + margin
    ) {
      atx = Math.round(px / SIZE);
      atz = Math.round(pz / SIZE);
    }
    // Dispose beyond the ring (relative to the anchor); discard an
    // in-flight build whose tile left the ring.
    for (const key of [...tiles.keys()]) {
      const [tx, tz] = key.split(',').map(Number);
      if (Math.max(Math.abs(tx - atx), Math.abs(tz - atz)) > RADIUS) {
        disposeTile(key);
      }
    }
    if (pending && Math.max(Math.abs(pending.tx - atx), Math.abs(pending.tz - atz)) > RADIUS) {
      pending = null;
    }
    // The anchor tile (where the player stands, modulo the margin) builds
    // SYNCHRONOUSLY — never let the capsule fall through unloaded ground
    // (e.g. a save-load teleport far from the current ring).
    if (!tiles.has(tileKey(atx, atz))) {
      if (pending && pending.tx === atx && pending.tz === atz) pending = null;
      buildTile(atx, atz);
    }
    // S6 — advance the sliced background build ONE stage-step per frame:
    // fill (TERRAIN_SLICE_ROWS rows) → geometry+normals → finalize
    // (mesh + collider, atomic). Bounded per-frame cost regardless of how
    // many tiles the ring is missing.
    const t0 = performance.now();
    if (pending) {
      if (pending.row <= CELLS) {
        const done = fillRows(pending, Tuning.TERRAIN_SLICE_ROWS);
        const ms = performance.now() - t0;
        if (ms > _perf.maxStageMs.fill) _perf.maxStageMs.fill = ms;
        void done;
      } else if (!pending.geo) {
        assembleGeometry(pending);
        const ms = performance.now() - t0;
        if (ms > _perf.maxStageMs.geometry) _perf.maxStageMs.geometry = ms;
      } else {
        finalizeTile(pending);
        pending = null;
        const ms = performance.now() - t0;
        if (ms > _perf.maxStageMs.finalize) _perf.maxStageMs.finalize = ms;
      }
      const ms = performance.now() - t0;
      _perf.sliceSteps++;
      if (ms > _perf.maxSliceMs) _perf.maxSliceMs = ms;
    } else {
      // Start the next missing ring tile (nearest-first).
      outer:
      for (let d = 1; d <= RADIUS; d++) {
        for (let tx = atx - d; tx <= atx + d; tx++) {
          for (let tz = atz - d; tz <= atz + d; tz++) {
            if (Math.max(Math.abs(tx - atx), Math.abs(tz - atz)) !== d) continue;
            if (!tiles.has(tileKey(tx, tz))) {
              pending = newTileBuild(tx, tz);
              break outer;
            }
          }
        }
      }
    }
  };

  // --- Sampling helpers ---
  // Tile lookup by world (x, z) — center-aligned, unbounded grid.
  const tileAt = (x: number, z: number): Tile | undefined =>
    tiles.get(tileKey(Math.round(x / SIZE), Math.round(z / SIZE)));

  const heightAt = (x: number, z: number): number => {
    const tile = tileAt(x, z);
    // Outside the loaded ring: answer with the closed-form sample so
    // procgen/creature queries work anywhere in the infinite field.
    if (!tile) return computeHeightAt(x, z);
    // Local coords within this tile: [-SIZE/2, +SIZE/2] → [0, CELLS].
    const fi = ((x - tile.centerX) / SIZE + 0.5) * CELLS;
    const fj = ((z - tile.centerZ) / SIZE + 0.5) * CELLS;
    // Clamp to a safe interpolation range. fi can land on CELLS exactly at
    // the +X edge — that's the boundary shared with the next tile; heights
    // there are identical so either tile's sample matches.
    const i = Math.min(CELLS - 1, Math.max(0, Math.floor(fi)));
    const j = Math.min(CELLS - 1, Math.max(0, Math.floor(fj)));
    const tx = Math.min(1, Math.max(0, fi - i));
    const tz = Math.min(1, Math.max(0, fj - j));
    const h00 = tile.heights[i * stride + j];
    const h10 = tile.heights[(i + 1) * stride + j];
    const h01 = tile.heights[i * stride + (j + 1)];
    const h11 = tile.heights[(i + 1) * stride + (j + 1)];
    return (
      h00 * (1 - tx) * (1 - tz) +
      h10 * tx * (1 - tz) +
      h01 * (1 - tx) * tz +
      h11 * tx * tz
    );
  };

  const _n = new THREE.Vector3();
  const normalAt = (x: number, z: number): THREE.Vector3 => {
    const e = 0.5;
    const hL = heightAt(x - e, z);
    const hR = heightAt(x + e, z);
    const hD = heightAt(x, z - e);
    const hU = heightAt(x, z + e);
    _n.set(hL - hR, 2 * e, hD - hU).normalize();
    return _n;
  };

  return {
    meshes,
    noise,
    heightAt,
    pureHeightAt: computeHeightAt,
    normalAt,
    groundMaterial: material,
    groundSample: (x, z) => {
      const n = biomes.rawAt(x, z);
      return { color: groundColorAt(x, z, n), biomeRaw: n };
    },
    recenter,
    tileKeys: () => [...tiles.keys()],
    perfStats: () => ({ ..._perf, maxStageMs: { ..._perf.maxStageMs } }),
    resetPerf: () => {
      _perf.syncBuilds = 0; _perf.maxSyncMs = 0;
      _perf.sliceSteps = 0; _perf.maxSliceMs = 0;
      _perf.maxStageMs.fill = 0; _perf.maxStageMs.geometry = 0; _perf.maxStageMs.finalize = 0;
    },
    worldHalfSize,
  };
}

// Smooth wind-warped dunes. Long ridges run perpendicular to a prevailing
// wind direction, with rounded crests and rounded valleys — no sharp peaks.
function smoothRidge(n: number): number {
  return Math.cos(n * Math.PI * 0.5);
}

// The Deep Desert — the erg (mega dune-sea) heightfield. A SEPARATE, much
// larger-amplitude dune profile that the terrain blends in inside an erg region
// (biomes.ergInfoAt gives the mask + this erg's wind + a per-erg noise offset).
//
// Shape: an ASYMMETRIC primary mega-dune (a gentle windward rise over
// ERG_WINDWARD_FRAC of the cycle, then a steep slip-face drop — the dry-sand
// angle of repose), modulated by a slow perpendicular ENVELOPE (breaks infinite
// walls into finite dune segments), plus a low-freq draa undulation and a fine
// wind-ripple overlay. Ridges elongate perpendicular to the erg's wind (aniso <
// 1) and meander via an along-wind domain warp. PURE: same (x, z, seed) → same
// height (no rand, no state) — descriptor gates + save persistence depend on it.
// Slope playability (windward ≤~30°, slip ~28-36°) is proven by the dune-slope
// probe; the DUNE_*/ERG_* constants are tuned against it.
function sampleErgHeight(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
  windRad: number,
  ox: number,
  oz: number,
): number {
  const cs = Math.cos(windRad);
  const sn = Math.sin(windRad);
  // Per-erg coordinate offset decorrelates ergs on the one shared noise instance.
  const X = x + ox, Z = z + oz;
  const u = X * cs + Z * sn;        // along wind
  const v = -X * sn + Z * cs;       // perpendicular to wind (ridges run along v)
  const aniso = Tuning.ERG_ANISO_RATIO;

  // Along-wind domain warp — meanders the ridge crests so they aren't ruler-straight.
  const warp = noise(v / Tuning.ERG_WARP_SCALE, u / Tuning.ERG_WARP_SCALE) * Tuning.ERG_ASYMMETRY_AMOUNT;
  const uShift = u + warp;

  // Perpendicular envelope — a slow height factor along the ridge so a single
  // ridge rises + fades into finite dune segments (not an endless wall).
  const envN = noise(v / Tuning.ERG_RIDGE_ENV_SCALE + 3.7, uShift / (2 * Tuning.ERG_DUNE_WAVELENGTH) - 1.9);
  const env = Tuning.ERG_RIDGE_ENV_MIN + (Tuning.ERG_RIDGE_ENV_MAX - Tuning.ERG_RIDGE_ENV_MIN) * (0.5 + 0.5 * envN);

  // Primary ASYMMETRIC mega-dune. `phase` walks along wind; its fractional part
  // within one dune cycle drives a piecewise profile: a smooth windward rise over
  // ERG_WINDWARD_FRAC, then a linear steep slip-face drop. Crest spacing is
  // jittered by a low-freq noise added as a BOUNDED PHASE OFFSET (never a
  // multiplier on the absolute coordinate — uShift is thousands of metres, so a
  // spatially-varying multiplier would race the phase into near-vertical chaos).
  const jitter = noise(uShift / (Tuning.ERG_DUNE_WAVELENGTH * 4) + 5.1, v / (Tuning.ERG_DUNE_WAVELENGTH * 4) - 2.3);
  const phase = uShift / Tuning.ERG_DUNE_WAVELENGTH + jitter * 0.5;
  const pf = phase - Math.floor(phase);   // [0,1) within a dune cycle
  const w = Tuning.ERG_WINDWARD_FRAC;
  let prof: number;
  if (pf < w) {
    const t = pf / w;                     // 0 at trough → 1 at crest (windward)
    prof = t * t * (3 - 2 * t);           // smoothstep rise — gentle windward face
  } else {
    prof = 1 - (pf - w) / (1 - w);        // linear steep drop — slip face
  }
  const duneH = prof * Tuning.ERG_DUNE_HEIGHT * env;

  // Low-freq draa undulation (0..H) — large-scale rise/fall so the sea isn't uniform.
  const draa = (0.5 + 0.5 * noise(X / Tuning.ERG_MEGA_WAVELENGTH, Z / Tuning.ERG_MEGA_WAVELENGTH)) * Tuning.ERG_MEGA_HEIGHT;

  // Fine wind-ripple overlay (kept small — must not spike the face slopes).
  const ripple = smoothRidge(noise(uShift * aniso / Tuning.ERG_MEDIUM_WAVELENGTH, v / Tuning.ERG_MEDIUM_WAVELENGTH)) * Tuning.ERG_MEDIUM_HEIGHT;

  return duneH + draa + ripple;
}

export function sampleHeight(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
): number {
  const cs = Math.cos(Tuning.DUNE_WIND_DIR_RAD);
  const sn = Math.sin(Tuning.DUNE_WIND_DIR_RAD);
  const u = x * cs + z * sn;       // along wind
  const v = -x * sn + z * cs;      // perpendicular to wind
  const aniso = Tuning.DUNE_ANISO_RATIO;

  const warp = noise(
    v / Tuning.DUNE_WARP_SCALE,
    u / Tuning.DUNE_WARP_SCALE,
  ) * Tuning.DUNE_ASYMMETRY_AMOUNT;
  const uShifted = u + warp;

  const np = noise(
    uShifted * aniso / Tuning.DUNE_RIDGE_SCALE_PRIMARY,
    v / Tuning.DUNE_RIDGE_SCALE_PRIMARY,
  );
  const r1 = smoothRidge(np);

  const ns = noise(
    uShifted * aniso / Tuning.DUNE_RIDGE_SCALE_SECONDARY,
    v / Tuning.DUNE_RIDGE_SCALE_SECONDARY,
  );
  const r2 = smoothRidge(ns);

  const base = noise(
    x / Tuning.DUNE_BASE_UNDULATION_SCALE,
    z / Tuning.DUNE_BASE_UNDULATION_SCALE,
  ) * Tuning.DUNE_BASE_UNDULATION_AMP;

  return r1 * Tuning.DUNE_PRIMARY_AMP +
         r2 * Tuning.DUNE_SECONDARY_AMP +
         base;
}

// Re-export so procgen consumers can apply the same biome height scaling
// as the tiles (without it, salt regions would tower above the tiles'
// near-flat salt).
export { biomeHeightScale };
