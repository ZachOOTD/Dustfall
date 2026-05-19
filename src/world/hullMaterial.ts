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
   *  wear variation, 0.3 = up to 30% darker patches). Default 0.15. */
  wearAmplitude?: number;
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
  const rustHex = opts.rustHex ?? 0x1a0a04;
  const bleachHex = opts.bleachHex ?? _deriveBleachHex(baseColor);
  const streakIntensity = opts.streakIntensity ?? 0.55;
  const wearAmplitude = opts.wearAmplitude ?? 0.15;

  const mat = new THREE.MeshLambertMaterial({
    color: baseColor,
    flatShading: true,        // matches the rest of the wreck palette
  });

  const rustColor = new THREE.Color(rustHex);
  const bleachColor = new THREE.Color(bleachHex);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRustColor = { value: rustColor };
    shader.uniforms.uBleachColor = { value: bleachColor };
    shader.uniforms.uStreakIntensity = { value: streakIntensity };
    shader.uniforms.uWearAmplitude = { value: wearAmplitude };

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

        // IQ-style precision-robust hash (same as terrainMaterial.ts).
        // Avoids the sin(dot()) hash trap that breaks at large
        // world coordinates — see memory/dustfall_shader_gotchas.md.
        float hullHash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float hullValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hullHash21(i + vec2(0.0, 0.0));
          float b = hullHash21(i + vec2(1.0, 0.0));
          float c = hullHash21(i + vec2(0.0, 1.0));
          float d = hullHash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float hullFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * hullValueNoise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }
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
