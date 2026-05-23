// Procedural fabric material — patches MeshLambertMaterial via
// onBeforeCompile to inject GPU-side weave + color variation + stain
// patches. Mirrors the terrainMaterial.ts pattern (D62: world-space
// varyings + value-noise FBM); zero bundle cost, preserves Lambert
// lighting + fog + shadows.
//
// Visual layers (composited multiplicatively over the base color):
//
//   1. WEAVE — fine cross-hatch from two perpendicular sin waves.
//      ~2.5cm cycle so individual threads read up close but blur into
//      texture at a distance. ±4% brightness — subtle enough not to
//      dominate the silhouette, present enough to kill the "flat
//      painted plane" look.
//
//   2. MID-SCALE COLOR — FBM noise picks between warm sun-bleached
//      cream + cooler dye-saturated tan. ~1.5m features so each panel
//      has visible "lighter here, darker there" character.
//
//   3. STAINS — sparse darker patches (dirt, soot from cooking fires,
//      weather damage). Larger FBM thresholded at the top end so only
//      ~15% of the surface gets the brown-tinted stain.
//
//   4. MICRO-GRAIN — per-pixel hash for the individual-fiber sparkle.
//      Tiny ±2% brightness; reads as fabric texture at close range.
//
// All four layers are sampled in WORLD-SPACE XZ coordinates (via a
// `vWorldFabric` varying) — UV space would require the geometry to
// have meaningful UVs, which BoxGeometry's six-face mapping doesn't
// provide for a draped fabric panel. World coords also mean different
// tents at different positions get visibly different surface patterns
// (free variety).

import * as THREE from 'three';

/** Build the patched fabric material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color, side })` on any cloth surface. */
export function createFabricMaterial(color: number, side?: THREE.Side): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color,
    side: side ?? THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    // ── Vertex shader: forward world position to the fragment stage. ──
    // BoxGeometry has identity model rotation at material-build time
    // (the rotation happens later via mesh.rotation), so the world
    // position is recomputed per-frame from the live modelMatrix.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldFabric;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vWorldFabric = (modelMatrix * vec4(position, 1.0)).xyz;
      `,
    );

    // ── Fragment shader: noise helpers + diffuse modulation. ──
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldFabric;

        // IQ-style hash — same precision-robust formulation as
        // terrainMaterial.ts. fract() before the arithmetic prevents
        // single-precision collapse at large world coords (large
        // sin argument → adjacent pixels hash identically).
        float fabricHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float fabricValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = fabricHash(i + vec2(0.0, 0.0));
          float b = fabricHash(i + vec2(1.0, 0.0));
          float c = fabricHash(i + vec2(0.0, 1.0));
          float d = fabricHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float fabricFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * fabricValueNoise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }
      `,
    );

    // `<color_fragment>` is where diffuseColor gets its base material
    // color. We modulate AFTER it so the per-layer modifications are
    // applied on top of the user-supplied base. Lambert lighting then
    // operates on the modulated color.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec3 wp = vWorldFabric;

        // 1. WEAVE — two perpendicular sin waves (warp threads + weft
        //    threads). 40 cycles/m = 2.5cm thread spacing. Combined as
        //    an average so intersections peak brighter and the gaps
        //    drop subtly darker. ±4% brightness keeps the effect a
        //    surface read, not a graphic pattern.
        float warp = 0.5 + 0.5 * sin(wp.x * 40.0);
        float weft = 0.5 + 0.5 * sin(wp.z * 40.0);
        float weave = (warp + weft) * 0.5;
        float weaveMod = mix(0.94, 1.06, weave);

        // 2. MID-SCALE COLOR VARIATION — FBM picks between warm and
        //    cool tints at ~1.5m feature scale. Reads as natural
        //    sun-bleaching + dye unevenness without making the panel
        //    look painted.
        float midNoise = fabricFbm(wp.xz * 0.6);
        vec3 sunBleached = vec3(1.04, 1.01, 0.95);   // pale cream
        vec3 dyeSaturated = vec3(0.92, 0.88, 0.80);  // warm tan
        vec3 midTint = mix(sunBleached, dyeSaturated, midNoise);

        // 3. STAINS — sparse darker patches. Larger FBM thresholded so
        //    only the high tail (~15% of surface) gets stained. Stain
        //    tint is brown — reads as soot, water damage, dirt.
        float stainNoise = fabricFbm(wp.xz * 0.18 + vec2(13.0, 27.0));
        float stainStrength = smoothstep(0.60, 0.82, stainNoise);
        vec3 stainTint = vec3(0.65, 0.58, 0.48);
        vec3 stainedTint = mix(midTint, stainTint, stainStrength * 0.55);

        // 4. MICRO-GRAIN — per-pixel hash sparkle. ±2% brightness;
        //    invisible past ~3m but reads as individual fiber light-
        //    catching when the player walks up to the tent.
        float grainHash = fabricHash(wp.xz * 80.0);
        float grainMod = mix(0.98, 1.02, grainHash);

        // Compose: weave + grain modulate brightness; mid+stain tint
        // modulates color. Multiplicative order doesn't matter — all
        // four are independent perturbations of the base color.
        diffuseColor.rgb *= weaveMod * grainMod;
        diffuseColor.rgb *= stainedTint;
      `,
    );
  };

  return mat;
}
