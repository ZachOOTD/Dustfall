// Procedural weathered-metal material — patches MeshLambertMaterial via
// onBeforeCompile to inject GPU-side scratches + worn highlights + grain
// + edge dirt. Mirrors the terrainMaterial.ts / fabricMaterial.ts pattern
// (D62 world-space varyings + IQ-style hash); zero bundle cost, preserves
// Lambert lighting + fog + shadows.
//
// Visual layers (composited multiplicatively on the base color):
//
//   1. SCRATCHES — directional 1D noise pattern along world-X (or a
//      configurable axis). Reads as the "brushed" look of weapon metal
//      + tool surfaces. Fine, high-frequency.
//
//   2. WORN HIGHLIGHTS — sparse FBM thresholded to brighter spots
//      simulating where hands have rubbed the patina off (handles,
//      edges, frequently-touched faces). ~10% of surface gets a
//      noticeably brighter tint.
//
//   3. MICRO-GRAIN — per-pixel hash sparkle for close-range texture
//      under the viewmodel's draw distance. ±3% brightness.
//
//   4. EDGE DIRT — large-scale FBM thresholded to DARKER patches.
//      Reads as soot/oil accumulation in recesses + along seams.
//      Sparse so the base color still dominates.
//
// All four layers sample in WORLD-SPACE — different metal objects at
// different world positions get visibly different surface variation
// for free. Viewmodels (anchored to camera) all share a slowly-changing
// "stable" position via the cameraToObject offset, so they don't flicker
// — see comment at the bottom about the cameraPos uniform if needed.

import * as THREE from 'three';
import { iqNoise2D } from './shaderNoise.ts';

export interface MetalMaterialOpts {
  /** Direction (radians) of the scratch grain in world XZ. 0 = +X.
   *  Different per-tool yaw gives variety; default π/4. */
  scratchAngle?: number;
  /** Scale of the worn-highlight blotches. Smaller = finer. Default 4.0. */
  wornScale?: number;
  /** Strength of the scratches (±brightness). Default 0.05 (subtle). */
  scratchStrength?: number;
  /** ACAD — rust/oxidation coverage 0..1 (FBM patches + downward drip streaks
   *  tinted rust-orange). 0 = clean metal; ~0.3 = weathered; ~0.6 = heavily
   *  corroded/scrappy. Default 0. The desert weathers everything — the item
   *  `vmMetal` wrapper defaults this up so all held gear reads aged. */
  rustLevel?: number;
  /** Whether to render double-sided (default false). */
  doubleSide?: boolean;
  /** D109 — sample the noise textures in OBJECT-LOCAL coords instead
   *  of world coords. Required for MOVING entities (sled body, raider
   *  weapons swinging) — world-space sampling causes scratches +
   *  worn highlights + dirt patches to crawl across the surface as
   *  the entity moves. Default false (static surfaces get coherent
   *  world-aligned weathering). */
  localSpace?: boolean;
}

/** Build the patched weathered-metal material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color })` on any metal surface. */
export function createMetalMaterial(
  color: number,
  opts: MetalMaterialOpts = {},
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: false,                          // metal benefits from smooth shading
  });

  const scratchAngle = opts.scratchAngle ?? Math.PI / 4;
  const wornScale = opts.wornScale ?? 4.0;
  const scratchStrength = opts.scratchStrength ?? 0.05;
  const rustLevel = opts.rustLevel ?? 0;   // ACAD — 0 = none; higher = rustier/scrappier

  // ACAH perf — pass the per-instance params as UNIFORMS instead of baking them
  // into the GLSL string. The injected source is then IDENTICAL across all metal
  // materials, so Three compiles ONE program for them all (vs one program per
  // variant — the D175/D177 cache-key approach was correct but grew the program
  // count ~40 for metal alone, costing startup-compile time + per-frame material
  // state-switching). Each material still renders its OWN values via its own
  // uniform set. No customProgramCacheKey needed: identical source + props →
  // shared program; only `side` (FrontSide/DoubleSide) splits it, which Three
  // keys natively. (Supersedes the metal half of D175/D177.)
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uScratchAngle = { value: scratchAngle };
    shader.uniforms.uWornScale = { value: wornScale };
    shader.uniforms.uScratchStrength = { value: scratchStrength };
    shader.uniforms.uRustLevel = { value: rustLevel };
    shader.uniforms.uLocalSpace = { value: opts.localSpace ? 1.0 : 0.0 };
    // Forward world position to the fragment stage. Geometry may be
    // animated (viewmodels bob), so we recompute world position per
    // frame from the live modelMatrix.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldMetal;
        uniform float uLocalSpace;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        // D109 — uLocalSpace selects object-frame (1) vs world-frame (0) noise
        // coords; object frame keeps weathering anchored on MOVING surfaces.
        // A uniform branch (not a compile-time variant) so all metal shares one program.
        vWorldMetal = (uLocalSpace > 0.5) ? position : (modelMatrix * vec4(position, 1.0)).xyz;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldMetal;
        uniform float uScratchAngle;
        uniform float uWornScale;
        uniform float uScratchStrength;
        uniform float uRustLevel;

        // IQ-style hash + value noise + FBM (matches terrainMaterial
        // + fabricMaterial conventions).
        ${iqNoise2D({ hash: 'metalHash', valueNoise: 'metalValueNoise', fbm: 'metalFbm', octaves: 3 })}
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec3 wpm = vWorldMetal;

        // 1. SCRATCHES — project world XZ onto the scratch axis, sample
        //    1D-stripey noise across the perpendicular axis. Gives the
        //    "brushed metal" directional grain.
        float sA = uScratchAngle;
        float scratchCoord = wpm.x * sin(sA) - wpm.z * cos(sA);
        float scratchNoise = metalHash(vec2(scratchCoord * 90.0, wpm.y * 2.0));
        float scratchMod = mix(1.0 - uScratchStrength, 1.0 + uScratchStrength, scratchNoise);

        // 2. WORN HIGHLIGHTS — FBM thresholded to bright spots. Where
        //    palms/cloth would have rubbed the patina off. ~10% of
        //    surface area gets a noticeable lighten.
        float wornNoise = metalFbm(wpm.xz * uWornScale);
        float wornStrength = smoothstep(0.62, 0.80, wornNoise);
        vec3 wornTint = vec3(1.12, 1.10, 1.05);
        vec3 baseTinted = mix(vec3(1.0), wornTint, wornStrength * 0.6);

        // 3. MICRO-GRAIN — per-pixel hash. Tiny ±3% brightness.
        float grainHash = metalHash(wpm.xz * 220.0);
        float grainMod = mix(0.97, 1.03, grainHash);

        // 4. EDGE DIRT — large-scale FBM thresholded to DARKER patches.
        //    Sparse so the metal color still dominates. ~12% of surface.
        float dirtNoise = metalFbm(wpm.xz * 1.2 + vec2(7.0, 19.0));
        float dirtStrength = smoothstep(0.65, 0.85, dirtNoise);
        vec3 dirtTint = vec3(0.58, 0.55, 0.48);
        vec3 dirtTinted = mix(baseTinted, dirtTint * baseTinted, dirtStrength * 0.55);

        // Compose: scratches + grain modulate brightness, worn + dirt
        // modulate tint. Multiplicative — order doesn't matter.
        diffuseColor.rgb *= scratchMod * grainMod;
        diffuseColor.rgb *= dirtTinted;

        // 5. RUST (ACAD) — FBM patches + downward drip streaks, tinted toward
        //    rust-orange (oxidation EATS the metal color, so we mix TO rust, not
        //    multiply). The desert weathers everything; rustLevel sets coverage.
        float rustLevel = uRustLevel;
        if (rustLevel > 0.001) {
          float rustField = metalFbm(wpm.xz * 2.3 + vec2(31.0, 5.0));
          // Stretch along Y so rust runs DOWN the surface like real drips.
          float rustDrip = metalFbm(vec2((wpm.x + wpm.z) * 3.2, wpm.y * 0.55) + 13.0);
          float rustN = rustField * 0.6 + rustDrip * 0.4;
          float rustThresh = mix(0.92, 0.36, rustLevel);   // more rustLevel → lower threshold → more rust
          float rustS = smoothstep(rustThresh, rustThresh + 0.2, rustN) * rustLevel;
          // Two-tone: deep rust core → lighter oxide halo for depth.
          vec3 rustCore = vec3(0.40, 0.18, 0.09);
          vec3 rustHalo = vec3(0.55, 0.32, 0.18);
          vec3 rustCol = mix(rustHalo, rustCore, smoothstep(rustThresh, 1.0, rustN));
          diffuseColor.rgb = mix(diffuseColor.rgb, rustCol, rustS * 0.85);
        }
      `,
    );
  };

  return mat;
}
