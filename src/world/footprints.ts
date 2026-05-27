// Player + lizard footprint decals (Session Y).
//
// Each kind is a single InstancedMesh of small quads (~22×36cm for player,
// ~10×10cm for lizard) drawn over the terrain. Instances are pooled — when
// the pool is full, the oldest gets recycled. Per-instance alpha is patched
// in via `onBeforeCompile` reading an `instanceOpacity` attribute, so 200+
// decals render in a single draw call yet still fade independently.
//
// Spawn rules (callers enforce):
//   - Player: one decal per existing footstep cadence in controller.ts.
//     Caller alternates L/R foot via `lateralSign`. Skipped on rocky biome.
//   - Lizard: distance accumulator in lizard.ts; fire every
//     FOOTPRINT_LIZARD_CADENCE_M of travel, FLEE state only.
//
// Visuals are canvas-drawn so the asset bundle stays zero (project ethos —
// see `weather.ts:27` for the same approach with dust motes).

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';
import type { Terrain } from './terrain.ts';

export type FootprintKind = 'player' | 'lizard' | 'sled';

interface FootprintInstance {
  active: boolean;
  spawnTime: number;
}

interface KindPool {
  mesh: THREE.InstancedMesh;
  opacities: Float32Array;       // backing storage for instanceOpacity attr
  opacityAttr: THREE.InstancedBufferAttribute;
  instances: FootprintInstance[];
  nextIdx: number;               // round-robin write head
  size: number;                  // pool capacity
}

export interface FootprintRegistry {
  spawn: (
    kind: FootprintKind,
    x: number, z: number,
    yawRad: number,
    nowSec: number,
  ) => void;
  /** Mutates per-instance opacity attribute by age. Cheap — touches only
   *  active instances. */
  update: (nowSec: number) => void;
}

// ─────────────────────────────────────────────────────────────
// Canvas-drawn alpha masks (matches weather.ts:27 dust-mote pattern)
// ─────────────────────────────────────────────────────────────

function makePlayerFootprintTexture(): THREE.CanvasTexture {
  // 128×128 RGBA. Asymmetric oval — wider front (toes), narrower back (heel),
  // with a soft falloff on the alpha. Reads as a foot impression on sand.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  g.clearRect(0, 0, 128, 128);
  // Forward (toe) lobe — larger, near the top of the canvas
  const grad1 = g.createRadialGradient(64, 44, 4, 64, 44, 30);
  grad1.addColorStop(0,    'rgba(255,255,255,0.95)');
  grad1.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad1.addColorStop(1,    'rgba(255,255,255,0)');
  g.fillStyle = grad1;
  g.beginPath();
  g.ellipse(64, 44, 24, 30, 0, 0, Math.PI * 2);
  g.fill();
  // Rear (heel) lobe — smaller, lower
  const grad2 = g.createRadialGradient(64, 92, 2, 64, 92, 22);
  grad2.addColorStop(0,    'rgba(255,255,255,0.85)');
  grad2.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grad2.addColorStop(1,    'rgba(255,255,255,0)');
  g.fillStyle = grad2;
  g.beginPath();
  g.ellipse(64, 92, 18, 22, 0, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeSledTrackTexture(): THREE.CanvasTexture {
  // ACC playtest — REWRITE v2. Gaussian lateral falloff with NO hard
  // edges anywhere. Pre-fix the texture had a sharper falloff that
  // made the rectangular decal shape visible at boundaries, which
  // combined with the per-frame sled.yaw lerp produced visible
  // rotational stair-stepping. Now the alpha smoothly decays from
  // the center via gaussian to ~0 at the edges, blending into the
  // sand without any sharp rectangular silhouette. Adjacent decals
  // overlap in their soft-fade regions and read as one continuous
  // mark with no discernable boundaries.
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  g.clearRect(0, 0, 128, 64);
  // Gaussian profile: alpha = exp(-(nx*sigma)^2). Sigma controls width.
  // Smaller sigma = tighter peak; larger = wider spread. Pick to fit
  // the visible "trail" within ~70% of the canvas width, with soft
  // fade extending to the canvas edges.
  const SIGMA = 1.6;
  // ACC playtest — peak alpha dropped 0.45 → 0.18 to compensate for
  // ~5× the decal density (cadence 0.30 → 0.12). Combined effective
  // alpha at trail center ≈ 5 × 0.18 = 0.9 max — a strong but not
  // black depression. With normal alpha blending the sum saturates
  // smoothly rather than going opaque.
  const PEAK_ALPHA = 0.18;
  for (let x = 0; x < 128; x++) {
    const nx = (x - 64) / 64;  // -1 to +1
    const alpha = Math.exp(-nx * nx * SIGMA * SIGMA) * PEAK_ALPHA;
    g.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    g.fillRect(x, 0, 1, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeLizardTrackTexture(): THREE.CanvasTexture {
  // 64×64. Three small claw streaks fanning forward — abstract enough that
  // it reads as "tiny critter went this way" without anatomical claims.
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  g.clearRect(0, 0, 64, 64);
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  // Three streaks from a common back point fanning forward (+Y in canvas =
  // -Z in world after the rotateX below)
  const cx = 32, cy = 44;
  for (const dx of [-9, 0, 9]) {
    g.beginPath();
    g.moveTo(cx + dx * 0.6, cy);
    g.lineTo(cx + dx, cy - 22);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

// ─────────────────────────────────────────────────────────────
// Material — single material reused; onBeforeCompile patches per-instance opacity
// ─────────────────────────────────────────────────────────────

function makeFootprintMaterial(
  map: THREE.Texture,
  colorHex: number,
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    map,
    color: colorHex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,        // bias on top of terrain to avoid z-fight
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    fog: true,
    toneMapped: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float instanceOpacity;
         varying float vInstanceOpacity;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vInstanceOpacity = instanceOpacity;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vInstanceOpacity;`,
      )
      .replace(
        '#include <output_fragment>',
        `diffuseColor.a *= vInstanceOpacity;
         #include <output_fragment>`,
      );
  };
  return mat;
}

// ─────────────────────────────────────────────────────────────
// Pool construction
// ─────────────────────────────────────────────────────────────

function makePool(
  scene: THREE.Scene,
  kind: FootprintKind,
): KindPool {
  const size =
    kind === 'player' ? Tuning.FOOTPRINT_PLAYER_POOL :
    kind === 'lizard' ? Tuning.FOOTPRINT_LIZARD_POOL :
    Tuning.FOOTPRINT_SLED_POOL;
  const sx =
    kind === 'player' ? Tuning.FOOTPRINT_PLAYER_SIZE_X :
    kind === 'lizard' ? Tuning.FOOTPRINT_LIZARD_SIZE_X :
    Tuning.FOOTPRINT_SLED_SIZE_X;
  const sz =
    kind === 'player' ? Tuning.FOOTPRINT_PLAYER_SIZE_Z :
    kind === 'lizard' ? Tuning.FOOTPRINT_LIZARD_SIZE_Z :
    Tuning.FOOTPRINT_SLED_SIZE_Z;
  const colorHex =
    kind === 'player' ? Tuning.FOOTPRINT_COLOR_PLAYER_HEX :
    kind === 'lizard' ? Tuning.FOOTPRINT_LIZARD_COLOR_HEX :
    Tuning.FOOTPRINT_SLED_COLOR_HEX;
  const tex =
    kind === 'player' ? makePlayerFootprintTexture() :
    kind === 'lizard' ? makeLizardTrackTexture() :
    makeSledTrackTexture();

  // Plane geometry. Default plane is in the XY plane; rotate to lie on the
  // ground (XZ plane). Width = sx (lateral), height = sz (forward).
  const geom = new THREE.PlaneGeometry(sx, sz);
  geom.rotateX(-Math.PI / 2);

  const mat = makeFootprintMaterial(tex, colorHex);
  const mesh = new THREE.InstancedMesh(geom, mat, size);
  mesh.frustumCulled = false;     // bounding box would have to cover the world
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;           // ensure decals draw after terrain
  // Mark so the shadow walk in main.ts doesn't set castShadow back to true.
  mesh.userData.noShadow = true;

  // Per-instance opacity attribute — backs vInstanceOpacity in the patched shader.
  const opacities = new Float32Array(size);
  const opacityAttr = new THREE.InstancedBufferAttribute(opacities, 1);
  opacityAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('instanceOpacity', opacityAttr);

  // Park all instances out of view at boot. (InstancedMesh starts with
  // identity matrices that would draw at origin — visible until first spawn.)
  const hide = new THREE.Matrix4().makeTranslation(0, -10000, 0);
  for (let i = 0; i < size; i++) mesh.setMatrixAt(i, hide);
  mesh.instanceMatrix.needsUpdate = true;

  scene.add(mesh);

  const instances: FootprintInstance[] = [];
  for (let i = 0; i < size; i++) instances.push({ active: false, spawnTime: 0 });

  return { mesh, opacities, opacityAttr, instances, nextIdx: 0, size };
}

// ─────────────────────────────────────────────────────────────
// Public registry
// ─────────────────────────────────────────────────────────────

const _tmpMat = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3(1, 1, 1);
const _yAxis = new THREE.Vector3(0, 1, 0);
const _normalMatch = new THREE.Quaternion();
const _from = new THREE.Vector3(0, 1, 0);

export function createFootprintRegistry(
  scene: THREE.Scene,
  terrain: Terrain,
): FootprintRegistry {
  const player = makePool(scene, 'player');
  const lizard = makePool(scene, 'lizard');
  const sled = makePool(scene, 'sled');

  function spawn(
    kind: FootprintKind,
    x: number, z: number,
    yawRad: number,
    nowSec: number,
  ): void {
    const pool =
      kind === 'player' ? player :
      kind === 'lizard' ? lizard :
      sled;
    const i = pool.nextIdx;
    pool.nextIdx = (pool.nextIdx + 1) % pool.size;

    const groundY = terrain.heightAt(x, z) + Tuning.FOOTPRINT_OFFSET_Y;
    // Orient: first match yaw (around world Y), then tilt to terrain normal so
    // the decal lies flush on slopes instead of clipping into dunes.
    _tmpQuat.setFromAxisAngle(_yAxis, yawRad);
    const normal = terrain.normalAt(x, z);
    _normalMatch.setFromUnitVectors(_from, normal);
    _tmpQuat.premultiply(_normalMatch);

    _tmpPos.set(x, groundY, z);
    _tmpMat.compose(_tmpPos, _tmpQuat, _tmpScale);
    pool.mesh.setMatrixAt(i, _tmpMat);
    pool.mesh.instanceMatrix.needsUpdate = true;

    pool.opacities[i] = 1;
    pool.opacityAttr.needsUpdate = true;

    pool.instances[i].active = true;
    pool.instances[i].spawnTime = nowSec;
  }

  function update(nowSec: number): void {
    tickPool(player, nowSec);
    tickPool(lizard, nowSec);
    tickPool(sled, nowSec);
  }

  return { spawn, update };
}

function tickPool(pool: KindPool, now: number): void {
  const life = Tuning.FOOTPRINT_LIFETIME_S;
  const fade = Tuning.FOOTPRINT_FADE_TAIL_S;
  let dirty = false;
  for (let i = 0; i < pool.size; i++) {
    const inst = pool.instances[i];
    if (!inst.active) continue;
    const age = now - inst.spawnTime;
    if (age >= life) {
      inst.active = false;
      pool.opacities[i] = 0;
      dirty = true;
      continue;
    }
    // Hold full opacity until life - fade, then linear fade to 0.
    const remaining = life - age;
    if (remaining < fade) {
      const t = remaining / fade;
      // Smoothstep tail so the end fade isn't a hard linear cliff.
      const eased = t * t * (3 - 2 * t);
      if (Math.abs(pool.opacities[i] - eased) > 0.005) {
        pool.opacities[i] = eased;
        dirty = true;
      }
    }
  }
  if (dirty) pool.opacityAttr.needsUpdate = true;
}

export function updateFootprints(
  registry: FootprintRegistry,
  elapsed: number,
): void {
  registry.update(elapsed);
}
