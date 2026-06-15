// Procedural weathered-concrete material — patches a stock
// MeshLambertMaterial via onBeforeCompile to add concrete-specific
// weathering on top of the base color. Same architecture family as
// `hullMaterial.ts` (Session OO) and `terrainMaterial.ts` (Session
// MM). D62 rules apply: world-space normal varying (vWorldNormal),
// IQ-style precision-robust hash, no derivation of region from
// vertex color.
//
// Effects layered on top of the base concrete color:
//   1. Aggregate noise   — small-scale FBM (~2 cycles/m) modulating
//                          brightness in [0.94, 1.06]. Reads as
//                          individual pebbles in the cement mix when
//                          you stand close, fades to overall texture
//                          at distance.
//   2. Mineral mottling  — multi-scale FBM (~0.4 cycles/m) producing
//                          patches that shift slightly cooler (greyer)
//                          or warmer (tan), reading as different
//                          pours / batches / old patchwork repairs.
//   3. Salt-leach stains — vertical streaks like rust on hull, but
//                          PALER and concentrated TOWARD THE BOTTOM
//                          of the surface. Salt leaches from
//                          groundwater wicking up through old
//                          concrete, leaving pale efflorescence
//                          stains. Attenuated by (1 - vWorldNormal.y)
//                          like rust, plus a low-Y bias so the
//                          stains accumulate near grade.
//   4. Edge grime        — slightly darker patches where the
//                          aggregate noise is high — accumulated
//                          dust + lichen in surface cavities.
//
// Concrete differs from hull in that the streaks LIGHTEN the
// surface (efflorescence is whitish) rather than darken (rust is
// brown). Both use the same vertical-FBM streak primitive but with
// inverted color direction.

import * as THREE from 'three';
import { iqNoise2D } from './shaderNoise.ts';

export interface WeatheredConcreteOptions {
  /** Hex color of fresh concrete. Required. */
  baseColor: number;
  /** Hex color salt-leach streaks tint toward. Default: warm off-
   *  white efflorescence (`0xe0d8c4`). */
  leachHex?: number;
  /** Hex color for darker grime accumulation. Default: a deeper
   *  shade of the base color. */
  stainHex?: number;
  /** Strength of the salt-leach streak overlay (0 = none, 1 = full
   *  white wash). Default 0.45. */
  leachIntensity?: number;
  /** Maximum brightness shift from the aggregate noise layer.
   *  Default 0.06 (±6%). */
  aggregateAmplitude?: number;
}

/**
 * Build a patched MeshLambertMaterial with procedural concrete
 * weathering. Use anywhere you'd use a plain `new THREE.
 * MeshLambertMaterial({ color, flatShading: true })`.
 */
export function createWeatheredConcreteMaterial(opts: WeatheredConcreteOptions): THREE.MeshLambertMaterial {
  const baseColor = opts.baseColor;
  const leachHex = opts.leachHex ?? 0xe0d8c4;
  const stainHex = opts.stainHex ?? _deriveStainHex(baseColor);
  const leachIntensity = opts.leachIntensity ?? 0.45;
  const aggregateAmplitude = opts.aggregateAmplitude ?? 0.06;

  const mat = new THREE.MeshLambertMaterial({
    color: baseColor,
    flatShading: true,
  });

  const leachColor = new THREE.Color(leachHex);
  const stainColor = new THREE.Color(stainHex);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLeachColor = { value: leachColor };
    shader.uniforms.uStainColor = { value: stainColor };
    shader.uniforms.uLeachIntensity = { value: leachIntensity };
    shader.uniforms.uAggregateAmplitude = { value: aggregateAmplitude };

    // Vertex shader — same varyings as hullMaterial (different
    // names to avoid collision if both materials end up on the
    // same scene). D62: world-space normal.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPositionConcrete;
        varying vec3 vWorldNormalConcrete;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vWorldPositionConcrete = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormalConcrete = normalize(mat3(modelMatrix) * normal);
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPositionConcrete;
        varying vec3 vWorldNormalConcrete;
        uniform vec3 uLeachColor;
        uniform vec3 uStainColor;
        uniform float uLeachIntensity;
        uniform float uAggregateAmplitude;

        // IQ-style precision-robust hash + FBM (same as hullMaterial
        // / terrainMaterial). See memory/dustfall_shader_gotchas.md.
        ${iqNoise2D({ hash: 'concreteHash21', valueNoise: 'concreteValueNoise', fbm: 'concreteFbm', octaves: 4 })}
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec3 wp = vWorldPositionConcrete;

        // ── 1) Aggregate noise — small-scale FBM (~2 cycles/m).
        //    Reads as individual pebbles / sand grains in the
        //    cement matrix when the camera is close. Subtle
        //    brightness variation.
        float aggregate = concreteFbm(wp.xz * 2.0 + vec2(wp.y * 0.7, 0.0));
        float aggregateFactor = 1.0 + uAggregateAmplitude * (aggregate - 0.5) * 2.0;
        diffuseColor.rgb *= aggregateFactor;

        // ── 2) Mineral mottling — multi-scale low-freq FBM
        //    producing patches of slightly cooler or warmer tint.
        //    Different concrete pours / patches / repair work.
        float mottle = concreteFbm(wp.xz * 0.40 + vec2(13.0, wp.y * 0.25));
        vec3 mottleWarm = vec3(1.04, 1.00, 0.92);
        vec3 mottleCool = vec3(0.94, 0.97, 1.02);
        vec3 mottleTint = mix(mottleCool, mottleWarm, smoothstep(0.30, 0.70, mottle));
        diffuseColor.rgb *= mottleTint;

        // ── 3) Salt-leach stains — vertical streaks like rust
        //    streaks on hull but LIGHTENING toward leachColor
        //    (efflorescence is whitish, not dark). Concentrated
        //    toward the bottom of the surface — salt wicks UP from
        //    grade so stains are heaviest near terrain level.
        //
        //    Side-facing attenuation: vertical/down faces get
        //    streaks, top faces don't (water sits on top, doesn't
        //    streak down off the upper surface).
        //
        //    Low-Y bias: streaks fade out higher up the structure
        //    via smoothstep on world Y. The "low" reference depends
        //    on the structure; we use a soft falloff between
        //    wp.y = +3 and wp.y = +18 (typical dish-base range
        //    is roughly +2 to +6m world Y).
        float streakInput = (wp.x + wp.z) * 3.0 + wp.y * 0.3 * 6.28;
        float streakNoise = concreteFbm(vec2(streakInput, wp.y * 0.3));
        float streakMask = smoothstep(0.45, 0.78, streakNoise);
        float sideFacing = clamp(1.0 - vWorldNormalConcrete.y, 0.0, 1.0);
        // Higher = drier, fewer stains. Lower = wetter, more stains.
        float lowBias = 1.0 - smoothstep(3.0, 18.0, wp.y);
        float leachStrength = streakMask * sideFacing * lowBias * uLeachIntensity;
        diffuseColor.rgb = mix(diffuseColor.rgb, uLeachColor, leachStrength);

        // ── 4) Edge grime — darker patches where aggregate is high
        //    (rough surface) on corners / cavities. Subtle, ~5%
        //    darken at most. Uses the aggregate noise inverted so
        //    high-aggregate-noise spots get a slight stain wash.
        float grimeMask = smoothstep(0.65, 0.92, aggregate);
        diffuseColor.rgb = mix(diffuseColor.rgb, uStainColor, grimeMask * 0.18);
      `,
    );
  };

  return mat;
}

/**
 * Derive a "deep-grime" color from the base — darker, slightly
 * cooler. Used as the default stain tint.
 */
function _deriveStainHex(baseHex: number): number {
  const c = new THREE.Color(baseHex);
  const r = c.r * 0.55;
  const g = c.g * 0.55;
  const b = c.b * 0.60;     // cooler bias toward blue
  return new THREE.Color(r, g, b).getHex();
}
