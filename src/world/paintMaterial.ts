// Procedural painted-then-corroded material — for industrial surfaces
// that started life painted (sled frames, lantern body, locker, grill,
// fire-pit ring) and have weathered into a worn paint + exposed rust +
// vertical drip-streak look. Companion shader to metalMaterial.ts —
// metal is for bare/oiled surfaces, paint is for COATED surfaces.
//
// Visual layers:
//
//   1. PAINT CHIPS — FBM thresholded to spots where paint has flaked
//      off, revealing the rust-orange substrate underneath.
//
//   2. RUST BLEED — where paint is chipped, the substrate tint takes
//      over. Bleeds slightly around the chip edges via a smoothstep.
//
//   3. FADED PAINT — large-scale lightening + slight de-saturation
//      across the surface. Reads as "left in the sun for a decade".
//
//   4. VERTICAL DRIP STREAKS — rust runs DOWN from chip locations.
//      Cheaper than tracking actual chip positions: project world Y
//      into a vertical sin/noise pattern that reads as drip lines.
//
//   5. MICRO-GRAIN — per-pixel hash for close-range fiber texture.
//      Lower than metal's because painted surfaces are smoother.

import * as THREE from 'three';

export interface PaintMaterialOpts {
  /** Substrate (rust) color visible through chips. Default warm rust. */
  rustColor?: number;
  /** How aggressively paint has chipped (0..1). Default 0.5. */
  wearLevel?: number;
  /** Whether to render double-sided. Default false. */
  doubleSide?: boolean;
  /** ABN — when true, sample paint/rust/drip noise in OBJECT-LOCAL
   *  coords instead of world-space. Required for MOVING entities (speeder
   *  hull is the canonical case) — world-space sampling causes the chip
   *  pattern + drip streaks to crawl across the painted surface as the
   *  vehicle moves. Static painted surfaces (locker, well rim) should
   *  leave this false so adjacent surfaces get coherent world-aligned
   *  weathering. Default false. */
  localSpace?: boolean;
}

/** Build the patched painted-corroded material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color })` on any painted surface. */
export function createPaintedMetalMaterial(
  paintColor: number,
  opts: PaintMaterialOpts = {},
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color: paintColor,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: true,
  });

  // Pack rustColor into 3 floats for GLSL.
  const rust = new THREE.Color(opts.rustColor ?? 0x6a3818);
  const wear = opts.wearLevel ?? 0.5;
  // chipThreshold ranges 0.55 (heavy wear) .. 0.78 (light wear).
  const chipThreshold = 0.78 - wear * 0.23;
  const dripStrength = 0.15 + wear * 0.25;

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPaint;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      opts.localSpace
        /* glsl */
        ? `
          #include <begin_vertex>
          // ABN — localSpace: sample noise in object frame so paint chips
          // + drip streaks stay anchored to the surface as it moves.
          vWorldPaint = position;
        `
        /* glsl */
        : `
          #include <begin_vertex>
          vWorldPaint = (modelMatrix * vec4(position, 1.0)).xyz;
        `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPaint;

        float paintHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float paintValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = paintHash(i + vec2(0.0, 0.0));
          float b = paintHash(i + vec2(1.0, 0.0));
          float c = paintHash(i + vec2(0.0, 1.0));
          float d = paintHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float paintFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * paintValueNoise(p);
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

        vec3 wpp = vWorldPaint;
        vec3 rustColor = vec3(${rust.r.toFixed(3)}, ${rust.g.toFixed(3)}, ${rust.b.toFixed(3)});

        // 3. FADED PAINT (apply first — it tints the base paint color).
        float fadeNoise = paintFbm(wpp.xz * 0.25);
        vec3 fadedPaint = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.06, 0.95), fadeNoise * 0.5);

        // 1. PAINT CHIPS — FBM thresholded.
        float chipNoise = paintFbm(wpp.xz * 3.5 + vec2(11.0, 23.0));
        float chipStrength = smoothstep(${chipThreshold.toFixed(3)}, ${(chipThreshold + 0.10).toFixed(3)}, chipNoise);

        // 2. RUST BLEED — at chip locations, blend toward rust color.
        //    chipStrength=1 = full rust, fading at chip edges.
        vec3 paintOrRust = mix(fadedPaint, rustColor, chipStrength);

        // 4. VERTICAL DRIP STREAKS — pseudo-1D pattern keyed off world Y
        //    + a noise across world XZ. Multiplies a dark-tint factor at
        //    streak locations.
        float dripCoord = paintFbm(vec2(wpp.x * 8.0, wpp.z * 8.0));
        float dripVert = 0.5 + 0.5 * sin(wpp.y * 6.0 + dripCoord * 12.0);
        float dripMask = smoothstep(0.75, 0.95, dripVert) * smoothstep(0.45, 0.75, dripCoord);
        vec3 streaked = mix(paintOrRust, paintOrRust * vec3(0.55, 0.40, 0.30), dripMask * ${dripStrength.toFixed(3)});

        // 5. MICRO-GRAIN.
        float pGrain = paintHash(wpp.xz * 140.0);
        float grainMod = mix(0.98, 1.02, pGrain);

        diffuseColor.rgb = streaked * grainMod;
      `,
    );
  };

  return mat;
}
