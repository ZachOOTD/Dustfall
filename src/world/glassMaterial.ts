// Procedural glass material — patches MeshLambertMaterial via
// onBeforeCompile to inject frosted-distortion + edge-rim highlights
// + thin dust film on horizontal facets. Mirrors metalMaterial.ts /
// fabricMaterial.ts pattern (D62 world-space varyings + IQ-style hash).
// ABJ — Tier 2 C5. Applied to canteen globe + lantern dome (currently
// MeshBasicMaterial / plain Lambert).
//
// NOT refractive — refraction is expensive + breaks transparency sort
// in Three.js. Uses transparent: true + opacity ≈ 0.6 + the procedural
// frost effect to read as "thick, cloudy glass" without the cost.
//
// Visual layers (composited on the base color):
//
//   1. FROST — small-scale FBM modulates brightness ±8% to read as
//      light scattered through micro-imperfections in the glass body.
//      Tightly-grained.
//
//   2. EDGE HIGHLIGHTS — fresnel-like rim brightening using
//      world-space normal vs camera-relative view direction. Brighter
//      at silhouette edges, reads as "this is a curved surface, light
//      catches the rim." Implemented as 1 - max(dot(N, V), 0) on the
//      world-space normal.
//
//   3. DUST LAYER — opt-in. Slightly darkens horizontal-facing surfaces
//      (positive world-Y normal) per the stoneMaterial dust pattern;
//      gives the glass a "sitting on a shelf collecting dust" feel.
//      Gated by opts.dustLayer (0 = off, 1 = strong).

import * as THREE from 'three';

export interface GlassMaterialOpts {
  /** Strength of the frosted scatter (0 = clear, 1 = heavy frost).
   *  Default 0.5. Lower for lantern globe (we want light to read
   *  through); higher for canteen (water inside should be hinted-at). */
  frostLevel?: number;
  /** Strength of edge-highlight rim (0 = none, 1 = strong). Default 0.6. */
  edgeHighlight?: number;
  /** Dust film accumulation on horizontal surfaces (0 = pristine, 1 =
   *  heavy). Default 0.3. */
  dustLayer?: number;
  /** Opacity of the glass body. Default 0.55 (mostly translucent). */
  opacity?: number;
  /** Whether to render double-sided (default true — glass should show
   *  both sides since the player can see "into" the volume). */
  doubleSide?: boolean;
  /** ACT — sample the frost/dust noise (and the dust-on-top normal) in
   *  OBJECT-LOCAL coords instead of world-space (D109). Required for MOVING
   *  glass props (the lantern-globe viewmodel tracks the camera / rig hand
   *  each frame); world-space sampling makes the frost speckle crawl across
   *  the surface as the player walks. In local space the dust layer also
   *  follows the object's own "up" (correct for a carried lantern that
   *  rotates). Static glass (cockpit canopy) leaves this false. Default
   *  false. */
  localSpace?: boolean;
}

/** Build the patched glass material. Drop-in for canteen globe /
 *  lantern dome / future glass props. Uses `transparent: true` so
 *  it sorts after opaque geometry in the Three.js render pass. */
export function createGlassMaterial(
  color: number,
  opts: GlassMaterialOpts = {},
): THREE.MeshLambertMaterial {
  const frostLevel = opts.frostLevel ?? 0.5;
  const edgeHighlight = opts.edgeHighlight ?? 0.6;
  const dustLayer = opts.dustLayer ?? 0.3;
  const opacity = opts.opacity ?? 0.55;

  const mat = new THREE.MeshLambertMaterial({
    color,
    side: (opts.doubleSide ?? true) ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: false,
    transparent: true,
    opacity,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldGlass;
        varying vec3 vWorldGlassNormal;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      opts.localSpace
        /* glsl */
        ? `
          #include <begin_vertex>
          // ACT — localSpace (D109): anchor frost/dust to the object frame so
          // it doesn't crawl as a held/moving glass prop translates; the dust
          // layer follows the object's own up (correct for a carried lantern).
          vWorldGlass = position;
          vWorldGlassNormal = normalize(normal);
        `
        /* glsl */
        : `
          #include <begin_vertex>
          vWorldGlass = (modelMatrix * vec4(position, 1.0)).xyz;
          vWorldGlassNormal = normalize(mat3(modelMatrix) * normal);
        `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldGlass;
        varying vec3 vWorldGlassNormal;

        float glassHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float glassValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = glassHash(i + vec2(0.0, 0.0));
          float b = glassHash(i + vec2(1.0, 0.0));
          float c = glassHash(i + vec2(0.0, 1.0));
          float d = glassHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float glassFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * glassValueNoise(p);
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

        vec3 wpg = vWorldGlass;
        vec3 wnG = normalize(vWorldGlassNormal);

        // 1. FROST — tight FBM modulates brightness ±frostLevel * 0.08.
        //    Scaled enough that close-range camera sees the texture but
        //    far-range averages back to uniform.
        float frostN = glassFbm(wpg.xz * 18.0 + vec2(wpg.y * 9.0, 0.0));
        float frostMod = mix(1.0 - ${frostLevel.toFixed(3)} * 0.08,
                             1.0 + ${frostLevel.toFixed(3)} * 0.08, frostN);

        // 2. EDGE HIGHLIGHTS — fresnel-like rim. Compute the
        //    world-space view direction (camera → fragment). The dot
        //    of view-dir with world-normal is ~1 when facing the
        //    camera, ~0 at silhouette edges. So (1 - |dot|) is large
        //    at edges. Modulated by edgeHighlight opt.
        vec3 vCam = normalize(cameraPosition - wpg);
        float rimAmt = pow(1.0 - max(0.0, dot(wnG, vCam)), 2.0);
        float edgeMod = 1.0 + rimAmt * ${edgeHighlight.toFixed(3)} * 0.45;

        // 3. DUST LAYER — gate on world-up normal (horizontal facets
        //    accumulate dust). Slightly darkens + warms color.
        float upAmt = max(0.0, wnG.y);    // 1 on top-facing, 0 on side
        float dustN = glassFbm(wpg.xz * 2.5 + vec2(53.0, 11.0));
        float dustStrength = upAmt * smoothstep(0.5, 0.85, dustN) * ${dustLayer.toFixed(3)};
        vec3 dustTint = vec3(0.85, 0.80, 0.70);
        vec3 dustMix = mix(vec3(1.0), dustTint, dustStrength);

        diffuseColor.rgb *= frostMod * edgeMod;
        diffuseColor.rgb *= dustMix;
      `,
    );
  };

  return mat;
}
