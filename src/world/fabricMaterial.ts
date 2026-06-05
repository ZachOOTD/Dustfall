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

// Session ABE — wind shimmer uniforms. updateFabricShaderUniforms
// (main.ts tick) pushes time.elapsed + perceivedWindStrength to every
// registered fabric-material shader so the ripple animates and gates.
// Per-instance shader registration mirrors terrainMaterial.ts's
// _shaderRefs pattern (D62).
type FabricShaderRef = { uniforms: Record<string, { value: unknown }> };
const _shaderRefs = new Set<FabricShaderRef>();

export interface FabricMaterialOpts {
  /** ABN — skip the wind-shimmer vertex displacement. Required for
   *  VIEWMODEL fabric (cloth + bandage held in hand) — the shimmer
   *  samples in world coords, which become camera-relative for viewmodel
   *  meshes, so the displacement animates against player movement and
   *  reads as the held item "breathing" / expanding when the player
   *  walks. World tents + tarps should leave this false so the wind
   *  shimmer still sells the storm intensity. Default false. */
  disableShimmer?: boolean;
  /** PM-E (ACK) — build a `MeshStandardMaterial` (per-fragment lighting +
   *  roughness) with a derivative-based normal bump from the weave + fold noise,
   *  so cloth catches light with real thread/fold relief instead of reading as a
   *  flat painted plane. Opt-in (default Lambert) — world tents/tarps stay cheap;
   *  the player's worn garments use pbr for close-range realism. */
  pbr?: boolean;
  /** Standard roughness when `pbr` (default 0.95 — matte canvas). */
  roughness?: number;
  /** Bump strength when `pbr` (default 0.8). */
  bump?: number;
  /** ACT — sample the weave/stain/grain noise in OBJECT-LOCAL coords (D109),
   *  DECOUPLED from `disableShimmer`. Historically `disableShimmer:true` did
   *  double duty: it both skipped the wind displacement AND switched the
   *  fragment noise to local coords (so viewmodel/rig cloth wouldn't swim).
   *  That coupling meant a MOVING fabric that still wants wind shimmer had no
   *  way to avoid the crawl. `localSpace:true` forces local sampling on its
   *  own, so shimmer + no-swim can coexist. (Every current moving-fabric
   *  caller already passes `disableShimmer:true`, so they were already
   *  swim-safe — this option future-proofs the rare shimmer+moving case.)
   *  Default false. */
  localSpace?: boolean;
}

/** Build the patched fabric material. Drop-in replacement for
 *  `new MeshLambertMaterial({ color, side })` on any cloth surface.
 *  ABN — third optional arg adds `disableShimmer` for viewmodel callers. */
export function createFabricMaterial(
  color: number,
  side?: THREE.Side,
  opts?: FabricMaterialOpts,
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
  const mat = opts?.pbr
    ? new THREE.MeshStandardMaterial({
        color,
        side: side ?? THREE.FrontSide,
        roughness: opts.roughness ?? 0.95,
        metalness: 0.0,
      })
    : new THREE.MeshLambertMaterial({
        color,
        side: side ?? THREE.FrontSide,
      });
  const disableShimmer = opts?.disableShimmer ?? false;
  // ACT — local-space fragment sampling is implied by EITHER disableShimmer
  // (legacy coupling) OR the explicit localSpace flag. Shimmer displacement
  // is gated only by disableShimmer, so a moving fabric can have wind ripple
  // AND local (non-swimming) weave by passing { localSpace: true }.
  const useLocalCoords = disableShimmer || (opts?.localSpace ?? false);
  const bump = opts?.bump ?? 0.8;

  // ACAH (D175) — distinguish the per-instance baked GLSL so Three doesn't share
  // ONE compiled program across all fabric materials (which silently ignored
  // per-instance opts). See woodGrainMaterial / metalMaterial for the rationale.
  mat.customProgramCacheKey = () => 'fabric:' + JSON.stringify(opts ?? {});

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindStrength = { value: 0 };
    // ABN — only register for per-frame uniform updates if shimmer is
    // on. Viewmodel callers don't need the wind-tick.
    if (!disableShimmer) _shaderRefs.add(shader as unknown as FabricShaderRef);
    // ── Vertex shader: forward world position to the fragment stage,
    //    plus apply a small normal-direction shimmer driven by wind. ──
    // BoxGeometry has identity model rotation at material-build time
    // (the rotation happens later via mesh.rotation), so the world
    // position is recomputed per-frame from the live modelMatrix.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldFabric;
        varying vec3 vNrmFabric;
        uniform float uTime;
        uniform float uWindStrength;
      `,
    );
    // ACT — coords + shimmer decoupled. `vWorldFabric` (the fragment-noise
    // input) is object-local when useLocalCoords (disableShimmer OR localSpace),
    // world otherwise. The wind displacement is applied only when shimmer is
    // ON (!disableShimmer), and always derives its phase from the true world
    // position so out-of-phase per-instance billowing survives even with
    // local-space fragment sampling.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vNrmFabric = normal;
        vec3 _fabricWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        // useLocalCoords: anchor the weave/stains to the surface so they
        // don't crawl on a moving entity (D109). Static tents use world.
        ${useLocalCoords ? 'vWorldFabric = position;' : 'vWorldFabric = _fabricWorld;'}
        ${disableShimmer ? '' : `
          // Session ABE — wind shimmer. Sum of two phase-offset sin waves
          // in world-XZ at ~1m wavelength, driven by uTime, displaces the
          // vertex along its (model-space) normal. Amplitude scales with
          // uWindStrength: calm ≈ 0.5cm, storm peak ≈ 4cm. Reads as a
          // breathing/billowing fabric panel without needing real Verlet sim.
          float _fabRipple =
            sin(_fabricWorld.x * 6.28 + uTime * 1.7) +
            sin(_fabricWorld.z * 6.28 * 0.83 + uTime * 1.3 + 0.7);
          float _fabAmp = mix(0.005, 0.04, clamp(uWindStrength, 0.0, 1.0));
          transformed += normal * (_fabRipple * _fabAmp * 0.5);
        `}
      `,
    );

    // ── Fragment shader: noise helpers + diffuse modulation. ──
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldFabric;
        varying vec3 vNrmFabric;

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

    // PM-E (ACK) — cloth micro-relief for the PBR path only. Perturb the
    // per-fragment normal from a height = the weave cross-hatch + a coarse fold
    // FBM, via screen-space derivatives. Gives threads + soft folds that catch
    // light, instead of a flat painted plane. (vWorldFabric is object-local in
    // disableShimmer mode → relief stays anchored to the garment as it moves.)
    if (opts?.pbr) {
      // Baked occlusion — darken downward-facing cloth so undersides + the hem
      // interior + the underside of folds sit in soft shadow under flat ambient.
      shader.fragmentShader = shader.fragmentShader.replace(
        'diffuseColor.rgb *= stainedTint;',
        'diffuseColor.rgb *= stainedTint;\n        diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(-0.75, 0.35, vNrmFabric.y));',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
          #include <normal_fragment_maps>
          {
            vec3 wpn = vWorldFabric;
            float thread = 0.5 * (sin(wpn.x * 40.0) + sin(wpn.z * 40.0));   // weave
            float folds = fabricFbm(wpn.xz * 1.4) * 2.2;                    // soft folds
            float h = thread * 0.35 + folds;
            normal = normalize(normal + vec3(dFdx(h), dFdy(h), 0.0) * ${bump.toFixed(3)});
          }
        `,
      );
    }
  };

  return mat;
}

/** Session ABE — per-frame update for fabric wind shimmer. Pushes
 *  `time.elapsed` + the current wind strength (typically clamped from
 *  `weather.intensity` plus a small calm baseline) to every registered
 *  fabric-material shader so the ripple animates and gates correctly.
 *  Called from main.ts after weather + before render. */
export function updateFabricShaderUniforms(
  time: number,
  windStrength: number,
): void {
  for (const s of _shaderRefs) {
    const u = s.uniforms;
    if (u.uTime) (u.uTime as { value: number }).value = time;
    if (u.uWindStrength) (u.uWindStrength as { value: number }).value = windStrength;
  }
}
