// Session AAG — fine "dust motes" layer, complementary to ambientDust.
// Where ambientDust is the tan prevailing-wind drift (suppressed during
// storms), this layer is finer + more vertical, persists through
// storms (the indoor-air feel doesn't change with weather), and uses
// a near-white tint so motes pop visibly when lantern/fire light hits
// the air at night.
//
// Wraps around the camera using the same pattern as ambientDust /
// weather.ts so the layer stays centered on the player.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

export interface DustMotes {
  particles: THREE.Points;
  particleMat: THREE.PointsMaterial;
  particleVels: Float32Array;
  cameraRef: THREE.PerspectiveCamera;
}

/** DEEPER cycle 7 — SOFT POINT SPRITES. A bare `PointsMaterial` renders every point as a HARD,
 *  AXIS-ALIGNED SQUARE of the flat point colour. On the desert that mostly hides in the haze; in a
 *  cave the audit measured squares up to 29px across floating in front of the rock, which reads as a
 *  rendering artefact, not as dust. This gives each point a radial alpha falloff off `gl_PointCoord`
 *  — no texture (the zero-asset policy), no extra draw call, ~4 ALU per particle fragment.
 *  Exported because BOTH particle layers (fine motes + the tan wind drift) need it. */
export function softenPointSprites(mat: THREE.PointsMaterial): void {
  mat.onBeforeCompile = (shader): void => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      {
        float moteR = length(gl_PointCoord - vec2(0.5));
        float moteA = 1.0 - smoothstep(0.14, 0.5, moteR);
        if (moteA <= 0.004) discard;
        diffuseColor.a *= moteA;
      }`,
    );
  };
}

export function createDustMotes(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): DustMotes {
  const count = Tuning.DUST_MOTES_COUNT;
  const spread = Tuning.DUST_MOTES_SPREAD;
  const positions = new Float32Array(count * 3);
  const vels = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = Math.random() * 8 - 1;     // hover at chest-height
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    // Motes mostly float downward gently with small horizontal sway.
    vels[i * 3]     = (Math.random() - 0.5) * 0.20;
    vels[i * 3 + 1] = -0.05 + (Math.random() - 0.5) * 0.05;   // gentle downward drift
    vels[i * 3 + 2] = (Math.random() - 0.5) * 0.20;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Near-white tint + small size + low opacity. Motes are present
  // everywhere but only visible to the eye in lit areas — the lighting
  // contrast does the visual work, no shader required.
  const mat = new THREE.PointsMaterial({
    color: 0xe8dcc0,            // bone-warm white
    size: 0.04,                 // ~4cm motes
    transparent: true,
    opacity: Tuning.DUST_MOTES_OPACITY,
    depthWrite: false,
    fog: true,
    toneMapped: false,
    sizeAttenuation: true,
  });

  softenPointSprites(mat);

  const particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false;
  scene.add(particles);

  return { particles, particleMat: mat, particleVels: vels, cameraRef: camera };
}

const _camPos = new THREE.Vector3();

export function updateDustMotes(ctx: GameContext): void {
  const m = ctx.dustMotes;
  if (!m) return;

  // AAH — soft cross-fade against peak storm via opacity smoothstep over
  // [STORM_FADE_START, STORM_FADE_END]. Above the end threshold the storm
  // dust dominates anyway; below the start, motes hold full opacity. The
  // previous hard cut at 0.8 (AAG) popped visibly during storm onset.
  const storm = ctx.weather.intensity;
  const fadeStart = Tuning.DUST_MOTES_STORM_FADE_START;
  const fadeEnd = Tuning.DUST_MOTES_STORM_FADE_END;
  const t = (storm - fadeStart) / (fadeEnd - fadeStart);
  const k = Math.max(0, Math.min(1, t));
  const fade = 1 - k * k * (3 - 2 * k);   // smoothstep falloff (1 → 0)
  // DEEPER cycle 7 — UNDERGROUND the motes were OUT-READING THE ROCK. The material is toneMapped:false
  // (deliberate: motes should pop in lantern light at night), so in a cave whose lit rock tops out
  // around L50 a mote drew at L≈48 — brighter than most of the stone it floats in front of, which is
  // backwards. Scaled by the cave containment factor, so the desert layer is untouched at d=0.
  const caveD = ctx.caveAtmosphere ? ctx.caveAtmosphere.darkness : 0;
  const caveMul = 1 - caveD * (1 - Tuning.DUST_MOTES_CAVE_MUL);
  const targetOpacity = Tuning.DUST_MOTES_OPACITY * fade * caveMul;
  if (Math.abs(m.particleMat.opacity - targetOpacity) > 1e-3) {
    m.particleMat.opacity = targetOpacity;
  }
  // Skip drift compute entirely when fully invisible to save GPU writes.
  if (fade <= 0) {
    if (m.particles.visible) m.particles.visible = false;
    return;
  }
  if (!m.particles.visible) m.particles.visible = true;

  _camPos.copy(m.cameraRef.position);
  const spread = Tuning.DUST_MOTES_SPREAD;
  const half = spread / 2;
  // ACAH — at night, pull the upper vertical-wrap bound down so motes stay low
  // and don't drift up over the stars. Interpolate by sun height across the same
  // dusk window the ambient dust fades on; lower bound stays at -4.
  const fadeLo = Tuning.AMBIENT_DUST_NIGHT_FADE_LO;
  const fadeHi = Tuning.AMBIENT_DUST_NIGHT_FADE_HI;
  const dayF = Math.max(0, Math.min(1, (ctx.time.sunHeight - fadeLo) / (fadeHi - fadeLo)));
  const upperY = Tuning.DUST_MOTES_UPPER_Y_NIGHT
    + (Tuning.DUST_MOTES_UPPER_Y_DAY - Tuning.DUST_MOTES_UPPER_Y_NIGHT) * dayF;
  const bandH = upperY + 4;   // band spans [-4, upperY]
  const posAttr = m.particles.geometry.attributes.position;
  const arr = posAttr.array as Float32Array;
  const vels = m.particleVels;
  const count = Tuning.DUST_MOTES_COUNT;
  // Approximate frame dt for the drift step. Pulling dt from elsewhere
  // would require threading it; the typical 60fps frame is good enough
  // for slow-drift particles.
  const dt = 1 / 60;

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    arr[ix]     += vels[ix]     * dt;
    arr[ix + 1] += vels[ix + 1] * dt;
    arr[ix + 2] += vels[ix + 2] * dt;

    let lx = arr[ix]     - _camPos.x;
    let ly = arr[ix + 1] - _camPos.y;
    let lz = arr[ix + 2] - _camPos.z;
    if (lx >  half) lx -= spread;
    if (lx < -half) lx += spread;
    // Vertical wrap — motes that drift below the camera respawn above. The upper
    // bound (upperY) drops at night so motes stay low and off the stars (ACAH).
    if (ly < -4)     ly += bandH;
    if (ly > upperY) ly -= bandH;
    if (lz >  half) lz -= spread;
    if (lz < -half) lz += spread;
    arr[ix]     = _camPos.x + lx;
    arr[ix + 1] = _camPos.y + ly;
    arr[ix + 2] = _camPos.z + lz;
  }
  posAttr.needsUpdate = true;
}
