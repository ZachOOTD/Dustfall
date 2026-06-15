// Procedural bone material — patches MeshLambertMaterial via
// onBeforeCompile to inject hairline cracks + mineralization spots
// + age-bleach gradient + micro-grain. Mirrors the metalMaterial.ts /
// fabricMaterial.ts pattern (D62 world-space varyings + IQ-style hash).
// ABJ — Tier 2 C4. Applied to the opening-wreck skeleton + any future
// bone props (animal carcasses, fossils).
//
// Visual layers (composited multiplicatively on the base color):
//
//   1. CRACKS — thresholded FBM creates a network of dark hairline
//      cracks across the surface. The "old bone" character — fine,
//      web-like, distributed.
//
//   2. MINERALIZATION SPOTS — sparser, larger FBM thresholded to
//      slightly DARKER patches with a yellow-brown tint (mineral
//      seepage staining the bone).
//
//   3. AGE BLEACH — broad gradient brighter at world-up-facing
//      surfaces (sun-bleached) vs cavities. Computed from world-space
//      vertical position (vWorldBone.y) and modulated by FBM so it
//      reads as patchy rather than perfectly directional.
//
//   4. MICRO-GRAIN — per-pixel hash sparkle for close-range detail.
//      ±2% brightness (subtler than metal/wood since bone is more
//      uniform under macro).
//
// All four layers sample in WORLD-SPACE — different bone props at
// different positions get free per-instance variation. opts.crackDensity
// controls how cracked the bone reads; opts.ageBleach controls the
// sun-bleach gradient strength.

import * as THREE from 'three';
import { iqNoise2D } from './shaderNoise.ts';

export interface BoneMaterialOpts {
  /** Frequency of crack network (higher = more dense). Default 1.0. */
  crackDensity?: number;
  /** Strength of mineralization staining (0 = pristine, 1 = heavy).
   *  Default 0.5. */
  marrowHint?: number;
  /** Sun-bleach gradient strength (0 = uniform, 1 = strong contrast).
   *  Default 0.35. */
  ageBleach?: number;
  /** Whether to render double-sided (default false). */
  doubleSide?: boolean;
  /** ACT — sample the crack/marrow/bleach noise in OBJECT-LOCAL coords
   *  instead of world-space (D109). Required for MOVING bone props (the
   *  bone-handled knife viewmodel tracks the camera / rig hand each frame);
   *  world-space sampling makes the cracks crawl across the surface as the
   *  player walks. Static bone (wreck skeletons) leaves this false. Default
   *  false. */
  localSpace?: boolean;
}

/** Build the patched bone material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color })` on skeleton meshes. */
export function createBoneMaterial(
  color: number,
  opts: BoneMaterialOpts = {},
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: false,
  });

  const crackDensity = opts.crackDensity ?? 1.0;
  const marrowHint = opts.marrowHint ?? 0.5;
  const ageBleach = opts.ageBleach ?? 0.35;

  // ACAT T3 — per-instance params are UNIFORMS, not baked GLSL → all bone materials
  // share ONE compiled program (drops the customProgramCacheKey + per-variant bloat;
  // supersedes the bone half of D175). localSpace is a runtime uniform branch.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCrackDensity = { value: crackDensity };
    shader.uniforms.uMarrowHint = { value: marrowHint };
    shader.uniforms.uAgeBleach = { value: ageBleach };
    shader.uniforms.uLocalSpace = { value: opts.localSpace ? 1.0 : 0.0 };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldBone;
        uniform float uLocalSpace;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        // ACT/ACAT — uLocalSpace (D109) runtime branch: object frame (1) anchors
        // cracks on a MOVING bone prop so they don't crawl; world frame (0) static.
        vWorldBone = (uLocalSpace > 0.5) ? position : (modelMatrix * vec4(position, 1.0)).xyz;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldBone;
        uniform float uCrackDensity;
        uniform float uMarrowHint;
        uniform float uAgeBleach;

        ${iqNoise2D({ hash: 'boneHash', valueNoise: 'boneValueNoise', fbm: 'boneFbm', octaves: 4 })}
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec3 wpb = vWorldBone;

        // 1. CRACKS — thresholded FBM. The classic "voronoi crack" look
        //    is expensive; this cheap approximation uses 2 FBM samples
        //    at different scales and ANDs them at a high threshold to
        //    get a thin web-like dark network. crackDensity scales
        //    the spatial frequency.
        float cd = uCrackDensity;
        float crack1 = boneFbm(wpb.xz * 15.0 * cd);
        float crack2 = boneFbm(wpb.xz * 22.0 * cd + vec2(31.0, 17.0));
        float crackMask = step(0.62, crack1) * step(0.58, crack2);
        float crackMod = mix(1.0, 0.65, crackMask);

        // 2. MINERALIZATION SPOTS — sparser, large FBM with yellow-brown
        //    tint. Gated by marrowHint opt. ~15% of surface gets a
        //    mineral stain.
        float mineralNoise = boneFbm(wpb.xz * 2.5 + vec2(53.0, 11.0));
        float mineralStrength = smoothstep(0.62, 0.82, mineralNoise);
        vec3 mineralTint = vec3(0.85, 0.78, 0.62);   // yellow-brown
        vec3 mineralMix = mix(vec3(1.0), mineralTint, mineralStrength * uMarrowHint * 0.7);

        // 3. AGE BLEACH — brighter on sun-facing (positive world-Y)
        //    surfaces vs cavities. Gradient mod is 1.0 at y=0.5 going
        //    up to (1 + ageBleach * 0.25) at y=2.0, modulated by FBM so
        //    it's patchy not perfectly stratified.
        float yNorm = clamp((wpb.y - 0.3) / 1.7, 0.0, 1.0);
        float bleachNoise = boneFbm(wpb.xz * 0.8 + vec2(7.0, 41.0));
        float bleachFactor = yNorm * (0.7 + 0.3 * bleachNoise);
        float bleachMod = 1.0 + uAgeBleach * 0.25 * bleachFactor;

        // 4. MICRO-GRAIN — fine per-pixel hash for close range. Subtle.
        float microHash = boneHash(wpb.xz * 280.0);
        float microMod = mix(0.98, 1.02, microHash);

        diffuseColor.rgb *= crackMod * bleachMod * microMod;
        diffuseColor.rgb *= mineralMix;
      `,
    );
  };

  return mat;
}
