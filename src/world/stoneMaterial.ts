// Procedural stone / concrete material — for the satellite-dish
// concrete base, rock scatter, scavenger-camp ring stones, fire-ring
// stones, well rim stones, and any other mineral surfaces. Companion
// shader to metalMaterial.ts / paintMaterial.ts / fabricMaterial.ts.
//
// Visual layers:
//
//   1. AGGREGATE GRAIN — small high-freq noise dots reading as the
//      pebble/sand inclusions in cement, or the mineral mix in rock.
//      Slightly desaturated.
//
//   2. CRACKS — line-noise overlay. Cheap technique: project world XZ
//      onto a few angles, sample noise across the perpendicular axis,
//      threshold to thin dark lines.
//
//   3. DUST ACCUMULATION on top-facing surfaces — checks world normal
//      Y; the more upward-facing a face is, the more it gets a sandy
//      tan tint (simulates dust + sand settling on horizontal surfaces).
//
//   4. SUN-BLEACH — large-scale FBM picks between cool-gray (shaded)
//      and warm-bleached gray (sun-baked). Reads as weathered character
//      without making the surface look painted.
//
//   5. MICRO-GRAIN — per-pixel hash for close-range mineral fleck.

import * as THREE from 'three';

export interface StoneMaterialOpts {
  /** Color of dust accumulation on top-facing surfaces. Default tan. */
  dustColor?: number;
  /** How aggressively dust accumulates (0..1). Default 0.6. */
  dustStrength?: number;
  /** Whether to render double-sided. Default false. */
  doubleSide?: boolean;
  /** Crack density (0..1). 0 = no cracks, 1 = network. Default 0.4. */
  crackDensity?: number;
}

/** Build the patched stone/concrete material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color })` on any mineral surface. */
export function createStoneMaterial(
  color: number,
  opts: StoneMaterialOpts = {},
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: true,
  });

  const dust = new THREE.Color(opts.dustColor ?? 0xc8a878);
  const dustStrength = opts.dustStrength ?? 0.6;
  const crackThreshold = 1.0 - (opts.crackDensity ?? 0.4) * 0.15;   // 0.85..1.0

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldStone;
        varying vec3 vWorldNormalStone;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vWorldStone = (modelMatrix * vec4(position, 1.0)).xyz;
        // World-space normal (NOT view-space) so dust check is camera-
        // independent. Mirrors terrainMaterial.ts D62 pattern.
        vWorldNormalStone = normalize(mat3(modelMatrix) * normal);
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldStone;
        varying vec3 vWorldNormalStone;

        float stoneHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float stoneValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = stoneHash(i + vec2(0.0, 0.0));
          float b = stoneHash(i + vec2(1.0, 0.0));
          float c = stoneHash(i + vec2(0.0, 1.0));
          float d = stoneHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float stoneFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * stoneValueNoise(p);
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

        vec3 wps = vWorldStone;
        vec3 wns = vWorldNormalStone;
        vec3 dustCol = vec3(${dust.r.toFixed(3)}, ${dust.g.toFixed(3)}, ${dust.b.toFixed(3)});

        // 4. SUN-BLEACH (apply first, tints the base).
        float bleachNoise = stoneFbm(wps.xz * 0.20);
        vec3 cool = diffuseColor.rgb * vec3(0.96, 0.97, 1.00);
        vec3 warm = diffuseColor.rgb * vec3(1.06, 1.02, 0.92);
        vec3 bleached = mix(cool, warm, bleachNoise);

        // 1. AGGREGATE GRAIN — high-freq noise; small ±brightness.
        float agg = stoneFbm(wps.xz * 18.0);
        float aggMod = mix(0.92, 1.08, agg);

        // 2. CRACKS — sample noise across 2 perpendicular axes,
        //    threshold the MAX so any one direction's crack reads.
        float c0 = stoneFbm(vec2(wps.x * 3.0, wps.y * 0.4));
        float c1 = stoneFbm(vec2(wps.z * 3.0 + 17.0, wps.y * 0.4 + 5.0));
        float crackNoise = max(c0, c1);
        float crackMask = smoothstep(${crackThreshold.toFixed(3)}, ${(crackThreshold + 0.04).toFixed(3)}, crackNoise);
        float crackMod = mix(1.0, 0.55, crackMask * 0.7);

        // 3. DUST ACCUMULATION — gated on world-up component of normal.
        //    smoothstep(0.35, 0.95) so steep slopes get no dust, flat
        //    tops get full dust.
        float upGate = smoothstep(0.35, 0.95, wns.y);
        // Modulate dust amount with FBM so it's patchy, not uniform.
        float dustPatch = stoneFbm(wps.xz * 0.8 + vec2(31.0, 13.0));
        float dustAmount = upGate * mix(0.4, 1.0, dustPatch) * ${dustStrength.toFixed(3)};
        vec3 dustedColor = mix(bleached, dustCol, dustAmount * 0.55);

        // 5. MICRO-GRAIN.
        float sGrain = stoneHash(wps.xz * 200.0);
        float grainMod = mix(0.97, 1.03, sGrain);

        diffuseColor.rgb = dustedColor * aggMod * crackMod * grainMod;
      `,
    );
  };

  return mat;
}
