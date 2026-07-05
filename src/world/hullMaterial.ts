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
  // ── ACAY — surface-orientation weathering (the "flat tops" fix). Research:
  //    arid-desert hulls decay UV-fade → chalk → seam-rust → bare metal, and
  //    weathering is orientation-specific (tops = dust+chalk, undersides =
  //    heaviest oxidation, seams = rust origin). All default 0 so existing
  //    callers (the hand-modeled hero wrecks that share this factory) are
  //    byte-identical; the procgen materials opt in with elevated values.
  /** Warm ochre-grey desert dust that settles on UP-facing surfaces. Default 0. */
  dustStrength?: number;
  /** Hex of the settled dust crust. Default a warm ochre-grey. */
  dustHex?: number;
  /** Pale chalky UV-breakdown haze on top/upper surfaces. Default 0. */
  chalkStrength?: number;
  /** Thin rust crust on TOP-facing oxidation zones (tops aren't pristine). Default 0. */
  oxTopStrength?: number;
  /** Heavy, saturated oxidation on UNDERSIDES (shadowed moisture traps). Default 0. */
  oxDeepStrength?: number;
  /** Hex of the deep underside oxidation. Default a deep saturated rust-brown. */
  oxDeepHex?: number;
  /** Extra rust pooling at procedural "seam" ridges (rust originates at seams). Default 0. */
  seamRustStrength?: number;
  /** Sand-blast abrasion back to bare metal on the lower hull. Default 0. */
  abrasionStrength?: number;
  /** Hex of the pale UV-chalk veil on top/upper faces. Default a pale cool ochre. */
  chalkHex?: number;
  /** Sample the procedural weathering in OBJECT-LOCAL space instead of world space.
   *  Default false (world-space — the correct default for STATIC wrecks, so adjacent
   *  wrecks/panels sharing a world position line up their grime).
   *
   *  Set true for meshes whose parent group MOVES at runtime (the escape pod falls ~600m
   *  during the descent). With world-space sampling the noise field is pinned to world
   *  space, so as the mesh translates the pattern SLIDES across the surface — the "texture
   *  crawling" bug. Local-space sampling pins the pattern to the surface so it rides with
   *  the mesh, motionless relative to the hull. NOTE: only the position-based noise is
   *  pinned; `vWorldNormalHull` stays WORLD-space (the slope masks — streaks run down, sun
   *  bleach on top — must track true orientation; a static crash-pose re-orient of them is
   *  correct + causes no crawl). At rest the look is identical (a one-time constant offset
   *  of the noise field is invisible; the pattern statistics/scale are unchanged). */
  localSpace?: boolean;
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
  // ── ACAY surface-orientation weathering (all default 0 → hero callers unchanged).
  const dustStrength = opts.dustStrength ?? 0;
  const chalkStrength = opts.chalkStrength ?? 0;
  const oxTopStrength = opts.oxTopStrength ?? 0;
  const oxDeepStrength = opts.oxDeepStrength ?? 0;
  const seamRustStrength = opts.seamRustStrength ?? 0;
  const abrasionStrength = opts.abrasionStrength ?? 0;
  const localSpace = opts.localSpace ?? false;

  const mat = new THREE.MeshLambertMaterial({
    color: baseColor,
    flatShading: true,        // matches the rest of the wreck palette
  });

  const rustColor = new THREE.Color(rustHex);
  const bleachColor = new THREE.Color(bleachHex);
  const bareMetalColor = new THREE.Color(opts.bareMetalHex ?? 0x9ea2a6);
  const oxColor = new THREE.Color(opts.oxHex ?? oxHexDefault);   // ACAX — warm rust-orange oxidation zones
  const dustColor = new THREE.Color(opts.dustHex ?? 0xb8a079);   // ACAY — warm ochre-grey desert dust
  const oxDeepColor = new THREE.Color(opts.oxDeepHex ?? 0x5e3318); // ACAY — deep saturated underside rust
  const chalkColor = new THREE.Color(opts.chalkHex ?? 0xc9c3b2);  // ACAY — pale cool UV-chalk veil

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
    shader.uniforms.uDustColor = { value: dustColor };
    shader.uniforms.uDustStrength = { value: dustStrength };
    shader.uniforms.uChalkStrength = { value: chalkStrength };
    shader.uniforms.uOxTopStrength = { value: oxTopStrength };
    shader.uniforms.uOxDeepColor = { value: oxDeepColor };
    shader.uniforms.uOxDeepStrength = { value: oxDeepStrength };
    shader.uniforms.uSeamRustStrength = { value: seamRustStrength };
    shader.uniforms.uAbrasionStrength = { value: abrasionStrength };
    shader.uniforms.uChalkColor = { value: chalkColor };

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
        varying float vLocalYHull;
      `,
    );
    // localSpace: for meshes on a MOVING parent (the escape pod falls ~600m during the
    // descent), sample the noise from OBJECT-LOCAL position so the pattern is PINNED to the
    // surface and rides with the pod (world-space sampling makes it CRAWL as the pod moves).
    // The normal stays WORLD-space either way — the slope masks must track true orientation.
    const posExpr = localSpace ? 'position' : '(modelMatrix * vec4(position, 1.0)).xyz';
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vWorldPositionHull = ${posExpr};
        // For meshes whose model matrix only translates+rotates (no
        // scale), mat3(modelMatrix) * normal is the correct world-
        // space normal. Wrecks DO get rotated (yaw/pitch/roll for the
        // crashed-into-dune look), so the rotation matters here.
        vWorldNormalHull = normalize(mat3(modelMatrix) * normal);
        vLocalYHull = position.y;
      `,
    );

    // ── Fragment shader: noise helpers + diffuseColor modulation ──
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPositionHull;
        varying vec3 vWorldNormalHull;
        varying float vLocalYHull;
        uniform vec3 uRustColor;
        uniform vec3 uBleachColor;
        uniform float uStreakIntensity;
        uniform float uWearAmplitude;
        uniform float uAoStrength;
        uniform float uFleckStrength;
        uniform vec3 uBareMetalColor;
        uniform vec3 uOxColor;
        uniform float uOxStrength;
        uniform vec3 uDustColor;
        uniform float uDustStrength;
        uniform float uChalkStrength;
        uniform float uOxTopStrength;
        uniform vec3 uOxDeepColor;
        uniform float uOxDeepStrength;
        uniform float uSeamRustStrength;
        uniform float uAbrasionStrength;
        uniform vec3 uChalkColor;

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
        float streakInput = (wp.x + wp.z) * 4.0;   // ACAY round 5 — dropped the wp.y term that sheared streaks diagonally; verticality now comes only from the second (low-freq) noise coord
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

        // ACAY surface-orientation weathering — round 5 (adversarial panel 2):
        // undersides DE-STACKED (oxDeep owns the dark end; seam moved to flanks);
        // deck masks recentred on hullFbm's realised ~0.45-0.60 range so they fire;
        // dust/chalk made mutually-exclusive + dust cooler; oxTop given its own
        // duller crust hue; a hull-HEIGHT rust ramp so long cylinders aren't one
        // flat tube; vertical streaks de-sheared at the channel-2 source. ──────
        float upFacing = clamp(vWorldNormalHull.y, 0.0, 1.0);
        float downFacing = clamp(-vWorldNormalHull.y, 0.0, 1.0);
        // Hull-LOCAL height → "lower hull" band: drives the scour AND a belly-up
        // rust ramp so a long horizontal cylinder (all "side" normals) still decays
        // top-to-bottom instead of reading as one uniform tube.
        float lowBand = smoothstep(0.6, -0.8, vLocalYHull);

        // ── 7) Underside + lower-flank heavy oxidation — the most CORRODED metal
        //    (shadowed moisture trap). Saturated warm rust-brown (NOT near-black).
        //    Fires on down-facing AND lower flanks (lowBand) so cylinders rust from
        //    the belly up. oxDeep OWNS the dark end so AO/seam don't stack into mud.
        float oxDeepZone = hullFbm(wp.xz * 0.20 + vec2(wp.y * 0.10, 8.0));
        float oxDeepFace = max(downFacing, lowBand * sideFacing * 0.8);
        float oxDeepMask = smoothstep(0.30, 0.54, oxDeepZone) * oxDeepFace * uOxDeepStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, uOxDeepColor, oxDeepMask);

        // ── 8) Top oxidation crust — a DULLER, dust-contaminated sun-baked orange
        //    (distinct from the saturated flank rust) on up-facing zones. Applied
        //    before dust/chalk; topProtect keeps its hue from washing to grey.
        vec3 oxTopCol = mix(uOxColor, uDustColor, 0.45);
        float oxTopZone = hullFbm(wp.xz * 0.16 + vec2(7.0, wp.y * 0.06));
        float oxTopMask = smoothstep(0.38, 0.55, oxTopZone) * upFacing * uOxTopStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, oxTopCol, oxTopMask);
        float topProtect = 1.0 - 0.6 * oxTopMask;

        // ── 9) Dust crust (the flat-tops fix) — wind-blown dust on UP-facing
        //    surfaces, a cool grey-ochre HUE shift so decks read powder-buried.
        //    Masks recentred on the realised fBm range so the channel actually fires.
        float dustZone = hullFbm(wp.xz * 0.11 + vec2(3.0, wp.y * 0.05));
        float dustMask = smoothstep(0.28, 0.52, dustZone)
                       * smoothstep(0.22, 0.75, vWorldNormalHull.y) * uDustStrength * topProtect;
        diffuseColor.rgb = mix(diffuseColor.rgb, uDustColor, dustMask);

        // ── 10) Paint chalk — a pale low-chroma UV-haze, MUTUALLY EXCLUSIVE with the
        //    dust (1.0 - dustMask) so the two stages read distinct instead of merging.
        float chalkN = hullFbm(wp.xz * 0.22 + vec2(wp.y * 0.12, 11.0));
        float chalkFace = smoothstep(0.28, 0.80, vWorldNormalHull.y);
        float chalkMask = chalkFace * smoothstep(0.32, 0.52, chalkN) * uChalkStrength * topProtect * (1.0 - dustMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, uChalkColor, chalkMask);

        // ── 11) Rust pooling running DOWN — gravity-pooled rust in low-freq noise
        //    crevices (an APPROXIMATION, not true geometry seams), biased to the
        //    visible FLANKS (sideFacing — undersides are oxDeep's job) and to the
        //    LOWER hull, paired with a vertical drip that bleeds it down.
        float seamField = hullFbm(wp.xz * 0.9 + vec2(13.0, wp.y * 0.7));
        float seamRidge = 1.0 - smoothstep(0.0, 0.05, abs(seamField - 0.42));
        float dripField = hullFbm(vec2((wp.x + wp.z) * 3.0, wp.y * 0.25));
        float drip = smoothstep(0.42, 0.66, dripField);
        float seamMask = max(seamRidge * mix(0.4, 1.0, lowBand), drip * 0.7)
                       * clamp(sideFacing, 0.0, 1.0) * uSeamRustStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, uRustColor, seamMask);

        // ── 12) Sand-blast scour — LOWER hull abraded back toward cool bare metal
        //    (the only cool hue → temperature contrast). Sparse hard-edged patches.
        float abrN = hullValueNoise(wp.xz * 5.0 + vec2(wp.y * 3.0, 5.0));
        float abrMask = smoothstep(0.60, 0.80, abrN) * lowBand * uAbrasionStrength;
        diffuseColor.rgb = mix(diffuseColor.rgb, uBareMetalColor, abrMask);
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

/**
 * ACAY — the canonical procgen-wreck surface-weathering profile (the "flat-tops
 * fix": dust + chalk on decks, heavy underside oxidation, seam-pooled rust,
 * lower-hull abrasion). Spread into the procgen hull materials AND the
 * wreck-form studio so the studio is a FAITHFUL preview — tune HERE and both
 * update. Hand-modeled hero wrecks deliberately do NOT spread this (they keep
 * the cleaner default look that was tuned for them in ACAK/ACAL).
 */
export const HULL_WEATHERING_ACAY: Partial<RustedHullOptions> = {
  // Distinct, SATURATED, separated hues (the adversarial critique: channels had
  // collapsed into one monochrome-brown value ramp — push hue, not just value).
  rustHex: 0x6e3a1c,         // saturated mid-rust for streaks + seam-drips (was near-black → read as shadow)
  oxHex: 0xa85423,           // saturated rust-ORANGE side oxidation (was 0x8a4a26, too brown)
  oxDeepHex: 0x8a4119,       // round 5 — more chroma so undersides read saturated rust, not mud
  dustHex: 0x97978c,         // round 5 — cooler/greyer so deck dust separates from the warm flank rust
  chalkHex: 0xc9c3b2,        // pale low-chroma chalk veil, distinct from the dust
  bareMetalHex: 0x9aa0a4,    // cool grey scoured metal — the ONLY cool hue → temperature contrast
  // Strengths. The deck masks are recentred on hullFbm's realised ~0.45-0.60 range
  // (round 5) so the dust/chalk/oxTop channels actually fire near full strength.
  aoStrength: 0.15,          // round 5 — lowered further; oxDeep now owns underside depth+hue (de-stack)
  oxStrength: 0.60,
  oxTopStrength: 0.40,
  dustStrength: 0.58,
  chalkStrength: 0.34,
  oxDeepStrength: 0.56,      // round 5 — also fires on lower flanks now (cylinder belly-up ramp)
  seamRustStrength: 0.56,
  abrasionStrength: 0.52,
};
