// Procedural organic-skin material — for creature bodies (sandworm,
// lizard, companion). Companion shader to metalMaterial.ts /
// paintMaterial.ts / stoneMaterial.ts / fabricMaterial.ts.
//
// Visual layers:
//
//   1. SCALE CELLS — voronoi-like cell pattern. Cheap fake: take FBM
//      and threshold to produce blotchy "scale" regions with darker
//      borders between them. Gives a leathery / reptilian read at
//      mid-to-close range.
//
//   2. PIGMENT BLOTCHES — large-scale FBM picks between two body
//      tints (mid + saturated). Reads as natural pigment variation
//      rather than painted-uniform color.
//
//   3. VEINS / RIDGES — thin darker line-noise threading across the
//      body. Subtle. Reads as cartilage/muscle definition below the
//      skin surface.
//
//   4. SHEEN HIGHLIGHTS — sparse FBM thresholded to slightly brighter
//      spots. Reads as oily / scaly catching the light.
//
//   5. MICRO-GRAIN — per-pixel hash for very close range pore-feel.

import * as THREE from 'three';

export interface SkinMaterialOpts {
  /** Saturated tint mixed into the base via the pigment-blotch layer.
   *  Default: darker version of base color. */
  accentColor?: number;
  /** Cell pattern scale. Smaller = larger scales. Default 8.0. */
  scaleSize?: number;
  /** Whether to render double-sided. Default false. */
  doubleSide?: boolean;
  /** Sheen intensity (0..1). Default 0.5. */
  sheen?: number;
  /** ABN — when true, sample the noise pattern in OBJECT-LOCAL coords
   *  instead of world-space. Required for MOVING entities (companion,
   *  any creature that translates between frames) — world-space sampling
   *  causes the texture detail to crawl across the surface as the body
   *  moves, breaking the "static-but-detailed skin" read. Static entities
   *  (a placed corpse, a wreck skeleton) should leave this false so
   *  adjacent surfaces get coherent world-aligned noise. Default false. */
  localSpace?: boolean;
  /** PM-E (ACK) — build a `MeshStandardMaterial` instead of Lambert: per-FRAGMENT
   *  lighting (so a perturbed normal actually shades) + roughness, plus a
   *  derivative-based procedural micro-bump from the skin noise. This is the
   *  realism lever — Lambert is vertex-lit + smooth-normal, which reads as flat
   *  plastic. Opt-in (default false) so cheap creatures stay on Lambert. */
  pbr?: boolean;
  /** Standard-material roughness when `pbr` (default 0.92 — dry matte skin). */
  roughness?: number;
  /** Micro-bump strength when `pbr` (default 0.6). 0 = smooth. */
  bump?: number;
}

/** Build the patched organic-skin material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color })` on a creature body (or MeshStandard with
 *  `pbr: true` for the player — see SkinMaterialOpts.pbr). */
export function createSkinMaterial(
  color: number,
  opts: SkinMaterialOpts = {},
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
  const mat = opts.pbr
    ? new THREE.MeshStandardMaterial({
        color,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        roughness: opts.roughness ?? 0.92,
        metalness: 0.0,
        flatShading: false,
      })
    : new THREE.MeshLambertMaterial({
        color,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        flatShading: false,                          // organic = smooth
      });
  const bump = opts.bump ?? 0.6;

  // Default accent = darker version of the base color.
  const baseC = new THREE.Color(color);
  const accent = opts.accentColor !== undefined
    ? new THREE.Color(opts.accentColor)
    : new THREE.Color(baseC.r * 0.65, baseC.g * 0.65, baseC.b * 0.70);
  const scaleSize = opts.scaleSize ?? 8.0;
  const sheen = opts.sheen ?? 0.5;

  // ACAH (D175) — per-instance baked GLSL needs a distinguishing cache key or
  // Three shares ONE compiled program across all skin materials.
  mat.customProgramCacheKey = () => 'skin:' + JSON.stringify(opts ?? {});

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldSkin;
        varying vec3 vNrmSkin;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      opts.localSpace
        /* glsl */
        ? `
          #include <begin_vertex>
          // ABN — localSpace: sample noise in object frame so detail
          // stays anchored to the body as it moves.
          vWorldSkin = position;
          vNrmSkin = normal;
        `
        /* glsl */
        : `
          #include <begin_vertex>
          vWorldSkin = (modelMatrix * vec4(position, 1.0)).xyz;
          vNrmSkin = normal;
        `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldSkin;
        varying vec3 vNrmSkin;

        float skinHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float skinValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = skinHash(i + vec2(0.0, 0.0));
          float b = skinHash(i + vec2(1.0, 0.0));
          float c = skinHash(i + vec2(0.0, 1.0));
          float d = skinHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float skinFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * skinValueNoise(p);
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

        vec3 wpsk = vWorldSkin;
        vec3 accentCol = vec3(${accent.r.toFixed(3)}, ${accent.g.toFixed(3)}, ${accent.b.toFixed(3)});

        // 2. PIGMENT BLOTCHES (apply first — tints the base).
        float pigmentNoise = skinFbm(wpsk.xz * 0.35 + vec2(0.0, wpsk.y * 0.2));
        vec3 pigmentTinted = mix(diffuseColor.rgb, accentCol, pigmentNoise * 0.55);

        // 1. SCALE CELLS — FBM thresholded to bright cell interiors,
        //    darker cell borders (the "between" regions).
        float cellsNoise = skinFbm(wpsk.xyz.xz * ${scaleSize.toFixed(2)});
        // Inner cell brightness vs outer-darker:
        // smoothstep(0.45, 0.55) gives a sharp-ish cell boundary.
        float cellInner = smoothstep(0.45, 0.55, cellsNoise);
        float cellMod = mix(0.78, 1.08, cellInner);

        // 3. VEINS — line-noise across the body.
        float veinCoord = wpsk.x * 3.0 + skinFbm(wpsk.xz * 4.0) * 5.0;
        float veinNoise = fract(veinCoord * 0.5);
        float veinDist = min(veinNoise, 1.0 - veinNoise);
        float veinMask = smoothstep(0.04, 0.0, veinDist);
        float veinMod = mix(1.0, 0.78, veinMask * 0.45);

        // 4. SHEEN HIGHLIGHTS — FBM thresholded to bright spots.
        float sheenNoise = skinFbm(wpsk.xz * 1.8 + vec2(41.0, 7.0));
        float sheenStrength = smoothstep(0.65, 0.85, sheenNoise);
        vec3 sheenTinted = mix(pigmentTinted, pigmentTinted + vec3(0.15, 0.13, 0.10), sheenStrength * ${sheen.toFixed(3)});

        // 5. MICRO-GRAIN.
        float skGrain = skinHash(wpsk.xz * 180.0);
        float grainMod = mix(0.97, 1.03, skGrain);

        diffuseColor.rgb = sheenTinted * cellMod * veinMod * grainMod;
      `,
    );

    // PM-E (ACK) — baked occlusion (PBR path). Darken downward-facing surfaces
    // (local normal.y < 0) so undersides + recesses sit in soft shadow even
    // under the game's flat high-ambient daylight — gives the body form/solidity
    // without depending on scene lighting (which is a separate mood decision).
    if (opts.pbr) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'diffuseColor.rgb = sheenTinted * cellMod * veinMod * grainMod;',
        'diffuseColor.rgb = sheenTinted * cellMod * veinMod * grainMod;\n        diffuseColor.rgb *= mix(0.58, 1.0, smoothstep(-0.75, 0.35, vNrmSkin.y));',
      );
    }

    // PM-E (ACK) — procedural micro-bump for the PBR path only. MeshStandard
    // lights per-fragment, so perturbing `normal` from the skin noise gives the
    // surface real micro-relief (catches light unevenly = skin/cloth, not smooth
    // plastic). Derivative-based bump (dFdx/dFdy of a world-sampled height) — no
    // tangents / normal-map texture needed. `normal` here is view-space; screen-
    // space derivatives perturb it convincingly for organic micro-detail.
    if (opts.pbr) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
          #include <normal_fragment_maps>
          {
            float bh = skinFbm(vWorldSkin.xz * ${(scaleSize * 1.6).toFixed(2)})
                     + 0.5 * skinFbm(vWorldSkin.xz * ${(scaleSize * 3.3).toFixed(2)});
            normal = normalize(normal + vec3(dFdx(bh), dFdy(bh), 0.0) * ${bump.toFixed(3)});
          }
        `,
      );
    }
  };

  return mat;
}
