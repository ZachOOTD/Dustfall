// Procedural wood-grain material — patches MeshLambertMaterial via
// onBeforeCompile to inject directional grain + concentric growth rings
// + weathering streaks. Mirrors the metalMaterial.ts / fabricMaterial.ts
// pattern (D62 world-space varyings + IQ-style hash). ABJ — Tier 2 C3.
// Applied to bare-Lambert wood props (sled planks, locker body) that
// shipped pre-ABH and skipped the texture overhaul.
//
// Visual layers (composited multiplicatively on the base color):
//
//   1. GRAIN — anisotropic noise stripes along a configurable grain
//      axis (opts.grainAxis radians; default 0 = +X). High-frequency
//      perpendicular variation reads as "wood fiber lines."
//
//   2. GROWTH RINGS — FBM warped into concentric circles around a
//      world-space center perpendicular to the grain axis. Wider
//      and slower-changing than grain; gives the "knotty plank" feel.
//
//   3. MICRO-GRAIN — per-pixel hash for close-range sparkle. ±3%
//      brightness; matches metalMaterial's micro layer.
//
//   4. WEATHERING — large-scale FBM thresholded to slightly DARKER
//      patches. Reads as weather-greyed wood patches in sun-exposed
//      areas. Sparse so the base color still dominates.
//
// All four layers sample in WORLD-SPACE — different wooden objects at
// different positions get free per-instance variation. opts.ringDensity
// controls growth-ring frequency; opts.weatherLevel controls how dark
// the weathered patches read.

import * as THREE from 'three';

export interface WoodGrainMaterialOpts {
  /** Direction (radians) of the grain in world XZ. 0 = +X. Default 0. */
  grainAxis?: number;
  /** Frequency of growth rings (higher = tighter rings). Default 8.0. */
  ringDensity?: number;
  /** Strength of weathering darkening (0 = none, 1 = strong). Default 0.4. */
  weatherLevel?: number;
  /** Strength of grain stripes (±brightness). Default 0.06. */
  grainStrength?: number;
  /** Whether to render double-sided (default false). */
  doubleSide?: boolean;
  /** ACT — sample the grain/ring/weathering noise in OBJECT-LOCAL coords
   *  instead of world-space (D109). Required for MOVING wood props (held
   *  viewmodel items — staff, torch, branch — which track the camera / rig
   *  hand every frame); world-space sampling makes the grain crawl across
   *  the surface as the player walks. Static wood (locker, posts) leaves
   *  this false for coherent world-aligned grain. Default false. */
  localSpace?: boolean;
}

/** Build the patched wood-grain material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color })` on any wood surface. */
export function createWoodGrainMaterial(
  color: number,
  opts: WoodGrainMaterialOpts = {},
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: false,                          // wood looks better smooth-shaded
  });

  const grainAxis = opts.grainAxis ?? 0.0;
  const ringDensity = opts.ringDensity ?? 8.0;
  const weatherLevel = opts.weatherLevel ?? 0.4;
  const grainStrength = opts.grainStrength ?? 0.06;

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldWood;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      opts.localSpace
        /* glsl */
        ? `
          #include <begin_vertex>
          // ACT — localSpace (D109): anchor grain to the object frame so it
          // doesn't crawl as a held/moving wood prop translates.
          vWorldWood = position;
        `
        /* glsl */
        : `
          #include <begin_vertex>
          vWorldWood = (modelMatrix * vec4(position, 1.0)).xyz;
        `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldWood;

        float woodHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float woodValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = woodHash(i + vec2(0.0, 0.0));
          float b = woodHash(i + vec2(1.0, 0.0));
          float c = woodHash(i + vec2(0.0, 1.0));
          float d = woodHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float woodFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * woodValueNoise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec3 wpw = vWorldWood;
        float gA = ${grainAxis.toFixed(4)};

        // 1. GRAIN — stripey noise perpendicular to grain axis. Project
        //    world XZ onto axis (grainCoord) + perpendicular (perpCoord),
        //    sample fine noise across perpCoord modulated slowly along
        //    grainCoord. Reads as elongated fiber lines.
        float grainCoord = wpw.x * cos(gA) + wpw.z * sin(gA);
        float perpCoord  = wpw.x * sin(gA) - wpw.z * cos(gA);
        float grainStripe = woodValueNoise(vec2(perpCoord * 35.0, grainCoord * 1.5));
        float grainMod = mix(1.0 - ${grainStrength.toFixed(3)}, 1.0 + ${grainStrength.toFixed(3)}, grainStripe);

        // 2. GROWTH RINGS — modulate brightness in concentric bands.
        //    Sample distance from a perpendicular axis (treats the plank
        //    as a slice through a tree trunk). Warp the radius with FBM
        //    so rings aren't perfectly circular — knotty character.
        float ringR = length(vec2(perpCoord, wpw.y));
        float ringWarp = woodFbm(vec2(grainCoord * 0.6, ringR * 0.8)) * 0.4;
        float ringSig = sin((ringR + ringWarp) * ${ringDensity.toFixed(2)});
        float ringMod = mix(0.85, 1.0, smoothstep(-0.3, 0.6, ringSig));

        // 3. MICRO-GRAIN — per-pixel hash for close-range texture. Small.
        float microHash = woodHash(wpw.xz * 180.0);
        float microMod = mix(0.97, 1.03, microHash);

        // 4. WEATHERING — large-scale FBM darkens sun-bleached spots.
        //    Strength gated by opts.weatherLevel.
        float weatherNoise = woodFbm(wpw.xz * 0.7 + vec2(11.0, 23.0));
        float weatherStrength = smoothstep(0.55, 0.85, weatherNoise);
        vec3 weatherTint = vec3(0.72, 0.66, 0.58);
        vec3 weatherMix = mix(vec3(1.0), weatherTint, weatherStrength * ${weatherLevel.toFixed(3)});

        diffuseColor.rgb *= grainMod * ringMod * microMod;
        diffuseColor.rgb *= weatherMix;
      `,
    );
  };

  return mat;
}
