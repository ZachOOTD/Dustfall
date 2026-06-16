// Procedural rusted-hull material — patches a stock MeshLambertMaterial
// via onBeforeCompile to add weathering on top of the base diffuse
// color. Zero bundle cost (no textures shipped), preserves Lambert
// lighting + fog + shadow. Pattern mirrors `terrainMaterial.ts` from
// Session MM — same IQ hash + FBM helpers, same vWorldPosition +
// vWorldNormal varying injection, same diffuseColor modulation at
// `<color_fragment>`. Read `memory/dustfall_shader_gotchas.md` before
// touching this — the view-space-vNormal trap (D62) applies here
// too: SLOPE-BASED EFFECTS USE vWorldNormal, NEVER vNormal.
//
// Effects layered on top of the base color (order matters):
//   1. Panel wear patches  — low-freq FBM (~0.3 cycles/m) multiplies
//                            brightness in [1 - wearAmp, 1.0]. Reads
//                            as paint scuffs / large oxidation zones.
//   2. Vertical rust streaks — high-X+Z-freq / low-Y-freq FBM creates
//                            a streaky vertical pattern (drip lines
//                            from rivets / junctions). Attenuated by
//                            (1 - vWorldNormal.y) so streaks are
//                            strongest on side / down-facing surfaces
//                            (water and oxidation run DOWN), zero on
//                            top-facing surfaces.
//   3. Sun bleach          — smoothstep(0.60, 0.95, vWorldNormal.y)
//                            mixes diffuseColor toward bleachColor
//                            on top-facing surfaces. UV-bleached
//                            paint on the upper hull.
//
// Flat-shading note (most wreck meshes use `flatShading: true`): with
// flat shading, all fragments of one triangle share the same vNormal
// (and vWorldNormal). Per-fragment vWorldPosition still varies
// linearly across the triangle, so the streak and wear PATTERNS still
// render per-fragment. What's per-triangle-constant: the streak
// ATTENUATION mask and the sun-bleach mask. The visible result is that
// each triangle reads as a discrete plate with its own wear state —
// some panels bleached, some streaked, some clean. That's NOT a bug,
// it's the right look for a riveted plated hull. Don't switch to
// smooth shading to "fix" the banding — it'll fight the flat-shaded
// low-poly aesthetic of the rest of the game.

import * as THREE from 'three';
import { iqNoise2D } from './shaderNoise.ts';

export interface RustedHullOptions {
  /** Hex color of the base hull paint. Required. */
  baseColor: number;
  /** Hex color streaks darken toward. Default: a deep rust orange-brown. */
  rustHex?: number;
  /** Hex color top-facing surfaces bleach toward. Default: a paler
   *  version of baseColor (the function derives a warm-pale tint). */
  bleachHex?: number;
  /** Strength of the rust-streak overlay (0 = none, 1 = full darken).
   *  Default 0.55. */
  streakIntensity?: number;
  /** Maximum brightness reduction from the panel-wear layer (0 = no
   *  wear variation, 0.3 = up to 30% darker patches). Default 0.20. */
  wearAmplitude?: number;
  /** Underside/down-facing form-AO darkening (0 = flat, 0.34 = up to 34%
   *  darker on undersides). Default 0.34. ACAP W3. */
  aoStrength?: number;
  /** Bare-metal scuff-fleck intensity (sparse chipped-paint spots). Default
   *  0.5. ACAP W3. */
  fleckStrength?: number;
  /** Hex color the scuff flecks reveal (chipped-to-bare-metal). Default a
   *  cool light metal. ACAP W3. */
  bareMetalHex?: number;
  /** Warm oxidation-zone color depth (low-freq rust-brown patches). Default
   *  0.32. ACAP W3. */
  oxStrength?: number;
  /** Hex color of the warm oxidation zones. Default a mid rust-brown. ACAP W3. */
  oxHex?: number;
}

/**
 * Build a patched MeshLambertMaterial with procedural rust streaks +
 * panel wear + sun bleach. Use anywhere you'd use a normal
 * `new THREE.MeshLambertMaterial({ color, flatShading })`. Pass
 * `flatShading: true` on the returned material if you want the
 * per-triangle plated-panel look (default behavior — see Three.js).
 */
export function createRustedHullMaterial(opts: RustedHullOptions): THREE.MeshLambertMaterial {
  const baseColor = opts.baseColor;
  const rustHex = opts.rustHex ?? 0x2a1206;            // ACAX — was 0x1a0a04 (near-black); warmer so streaks read as RUST, not just shadow
  const bleachHex = opts.bleachHex ?? _deriveBleachHex(baseColor);
  const streakIntensity = opts.streakIntensity ?? 0.55;
  const wearAmplitude = opts.wearAmplitude ?? 0.28;   // ACAX — was 0.20; more plate-to-plate tonal break-up
  const aoStrength = opts.aoStrength ?? 0.34;          // ACAP W3 — underside form darkening
  const fleckStrength = opts.fleckStrength ?? 0.7;     // ACAX — was 0.5; more bare-metal scuffs break up the flatness
  // ACAX — oxidation zones are the ONLY HUE-shifting weathering layer (the rest are
  // value-only). Boosted strength + a warmer/more-saturated rust-orange so the hull
  // reads as a PATCHWORK of differently-corroded plates ("less flat"), not one tone.
  const oxStrength = opts.oxStrength ?? 0.58;          // was 0.32
  const oxHexDefault = 0x8a4a26;                       // was 0x6b4326 — warmer, more saturated rust-orange

  const mat = new THREE.MeshLambertMaterial({
    color: baseColor,
    flatShading: true,        // matches the rest of the wreck palette
  });

  const rustColor = new THREE.Color(rustHex);
  const bleachColor = new THREE.Color(bleachHex);
  const bareMetalColor = new THREE.Color(opts.bareMetalHex ?? 0x9ea2a6);
  const oxColor = new THREE.Color(opts.oxHex ?? oxHexDefault);   // ACAX — warm rust-orange oxidation zones

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRustColor = { value: rustColor };
    shader.uniforms.uBleachColor = { value: bleachColor };
    shader.uniforms.uStreakIntensity = { value: streakIntensity };
    shader.uniforms.uWearAmplitude = { value: wearAmplitude };
    shader.uniforms.uAoStrength = { value: aoStrength };
    shader.uniforms.uFleckStrength = { value: fleckStrength };
    shader.uniforms.uBareMetalColor = { value: bareMetalColor };
    shader.uniforms.uOxColor = { value: oxColor };
    shader.uniforms.uOxStrength = { value: oxStrength };

    // ── Vertex shader: forward world position + world-space normal ──
    // D62: world-space normal, NOT vNormal (which is view space and
    // would make sun-bleach and streak masking flip around with
    // camera pitch).
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPositionHull;
        varying vec3 vWorldNormalHull;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vWorldPositionHull = (modelMatrix * vec4(position, 1.0)).xyz;
        // For meshes whose model matrix only translates+rotates (no
        // scale), mat3(modelMatrix) * normal is the correct world-
        // space normal. Wrecks DO get rotated (yaw/pitch/roll for the
        // crashed-into-dune look), so the rotation matters here.
        vWorldNormalHull = normalize(mat3(modelMatrix) * normal);
      `,
    );

    // ── Fragment shader: noise helpers + diffuseColor modulation ──
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPositionHull;
        varying vec3 vWorldNormalHull;
        uniform vec3 uRustColor;
        uniform vec3 uBleachColor;
        uniform float uStreakIntensity;
        uniform float uWearAmplitude;
        uniform float uAoStrength;
        uniform float uFleckStrength;
        uniform vec3 uBareMetalColor;
        uniform vec3 uOxColor;
        uniform float uOxStrength;

        // IQ-style precision-robust hash (same as terrainMaterial.ts).
        // Avoids the sin(dot()) hash trap that breaks at large
        // world coordinates — see memory/dustfall_shader_gotchas.md.
        ${iqNoise2D({ hash: 'hullHash21', valueNoise: 'hullValueNoise', fbm: 'hullFbm', octaves: 4 })}
      `,
    );

    // The `<color_fragment>` chunk sets diffuseColor.rgb from the
    // material color. We modulate AFTER that so our weathering layers
    // multiply / mix the base paint. Lambert lighting then operates
    // on the modulated color.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec3 wp = vWorldPositionHull;

        // ── 1) Panel wear patches — low-freq FBM (~3-4m features).
        //    Multiplies brightness in [1 - uWearAmplitude, 1.0].
        float wearN = hullFbm(wp.xz * 0.30 + vec2(wp.y * 0.18, 0.0));
        float wearFactor = 1.0 - uWearAmplitude * (1.0 - wearN);
        diffuseColor.rgb *= wearFactor;

        // ── 2) Vertical rust streaks — high horizontal freq (~4
        //    cycles/m via the x+z sum, giving ~0.25m-wide streak
        //    columns) and low vertical freq (~0.4 cycles/m, giving
        //    ~2.5m-tall streaks). Smoothstep to threshold the noise
        //    into a streak mask. Attenuated by (1 - vWorldNormalHull.y)
        //    so streaks vanish on top-facing surfaces (drips run
        //    DOWN, not up off the hull's roof).
        float streakInput = (wp.x + wp.z) * 4.0 + wp.y * 0.4 * 6.28;
        // Use the y world-coord directly as the second FBM coord so
        // adjacent stripes share noise vertically — that's what makes
        // them read as "streaks" instead of "blobs."
        float streakNoise = hullFbm(vec2(streakInput, wp.y * 0.4));
        float streakMask = smoothstep(0.40, 0.75, streakNoise);
        // Side / down attenuation. vWorldNormalHull.y = 1 (flat top)
        // → 0 attenuation = no streaks. vWorldNormalHull.y = 0 (vertical
        // wall) → 1 attenuation = full streaks.
        float sideFacing = clamp(1.0 - vWorldNormalHull.y, 0.0, 1.0);
        float streakStrength = streakMask * sideFacing * uStreakIntensity;
        diffuseColor.rgb = mix(diffuseColor.rgb, uRustColor, streakStrength);

        // ── 3) Sun bleach — top-facing surfaces mix toward
        //    bleachColor. Reads as UV-bleached paint on the upper
        //    hull. vWorldNormalHull.y > 0.6 starts to bleach, fully
        //    bleached at y > 0.95.
        float topFacing = smoothstep(0.60, 0.95, vWorldNormalHull.y);
        // Mix toward bleach by up to 30% so the underlying base color
        // still reads through (not pure white).
        diffuseColor.rgb = mix(diffuseColor.rgb, uBleachColor, topFacing * 0.30);

        // ── 4) Form darkening (cheap AO) — ACAP W3. Down-facing + underside
        //    surfaces sit in occlusion / self-shadow; darkening them deepens
        //    the hull's read from flat to volumetric. Pure value (no hue
        //    shift) → lowest-risk depth on the shared material.
        float downFacingHull = clamp(-vWorldNormalHull.y, 0.0, 1.0);
        diffuseColor.rgb *= (1.0 - downFacingHull * uAoStrength);

        // ── 5) Bare-metal scuff flecks — ACAP W3. Sparse high-freq spots where
        //    paint has chipped to bare metal (lighter, slightly cool). Threshold
        //    is high so it reads as occasional scratches, not noise; biased to
        //    side-facing surfaces (sideFacing from layer 2) where impacts scrape.
        float fleckN = hullValueNoise(wp.xz * 9.0 + vec2(wp.y * 6.0, 0.0));
        float fleck = smoothstep(0.80, 0.92, fleckN) * sideFacing * uFleckStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, uBareMetalColor, fleck);

        // ── 6) Oxidation zones — ACAP W3. A low-freq field tints some hull
        //    zones toward a warm rust-brown, so the hull reads as a patchwork of
        //    salvaged plates in different oxidation states (COLOR depth, not just
        //    value — the main fix for the flat-grey read). Side-facing biased
        //    (oxidation pools on walls/flanks, not sun-baked tops).
        float oxZone = hullFbm(wp.xz * 0.14 + vec2(wp.y * 0.08, 4.0));
        // ACAX — widened threshold (was 0.52,0.82) so MORE of the hull picks up the
        // warm rust-orange tint → a richer corroded patchwork, less uniform.
        float oxMask = smoothstep(0.44, 0.80, oxZone) * sideFacing * uOxStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, uOxColor, oxMask);
      `,
    );
  };

  return mat;
}

/**
 * Derive a warm-pale "sun-bleached" color from a base hull color.
 * Lifts each channel toward white and warms slightly (red+green get a
 * bigger lift than blue, mimicking yellowed UV paint).
 */
function _deriveBleachHex(baseHex: number): number {
  const c = new THREE.Color(baseHex);
  const r = Math.min(1, c.r + (1 - c.r) * 0.55);
  const g = Math.min(1, c.g + (1 - c.g) * 0.45);
  const b = Math.min(1, c.b + (1 - c.b) * 0.30);
  return new THREE.Color(r, g, b).getHex();
}
