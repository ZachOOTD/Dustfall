// Procedural terrain material — patches the standard MeshLambertMaterial
// via onBeforeCompile to inject GPU-side noise + slope-based detail. Zero
// bundle cost (no textures shipped), preserves Lambert lighting + fog +
// the existing per-vertex biome color blend.
//
// Per-biome fragment effects (blended by the vertex color so the
// transition is smooth across biome boundaries):
//
//   DUNE / ROCKY (sandStrength = 1 - saltness):
//     - Domain-warped 4-octave FBM for organic sand-zone color patches
//       (not the uniform-noise look the first pass had).
//     - High-frequency micro-grain at ~6 cycles/m for close-up sub-meter detail.
//     - Warm-amber / cool-pale color shift driven by the coarse grain
//       layer, so dips warm up (sun-baked) and crests pale out
//       (wind-bleached).
//     - Noise-warped scallop ripples (sin pattern with low-freq noise
//       displacement on the perpendicular axis) — reads as wind-formed
//       crescent ripples, not parallel stripes.
//
//   SALT (saltness * flatness):
//     - Voronoi (Worley F2-F1) cell pattern → desiccation cracks. Cells
//       are domain-warped so they're not a perfect honeycomb. Each cell
//       has a tiny brightness variation so the crust reads as discrete
//       plates rather than a uniform sheet.
//     - Crack edges darken to ~45% diffuse, suggesting depth + shadow
//       into the crack.
//     - Effect is multiplied by surface flatness (smoothstep on vNormal.y)
//       so steep salt slopes show no cracks (they'd weather differently
//       from a flat pan).
//
//   ALL BIOMES:
//     - Slope-based darkening: up to 30% darker on steep faces
//       (exposed grit on dune slip faces / weathered rock).
//     - Slope-based cool/desaturated tint: pushes steep faces toward a
//       cooler color so they read as a different material from the
//       warm flat sand.
//
// Why onBeforeCompile vs full ShaderMaterial: keeps the existing
// sun/moon Lambert lighting, fog, and shadow setup untouched — we just
// modulate diffuseColor before lighting kicks in. ~150 lines of GLSL
// vs a few hundred for a full lighting rewrite.

import * as THREE from 'three';
import { iqNoise2D } from './shaderNoise.ts';
import { Tuning } from '../config/tuning.ts';

// AAG — captured shader refs for the per-frame mirage uniform updates.
// One shader instance per material instance; each call to
// createTerrainMaterial registers its shader here when onBeforeCompile
// fires. updateTerrainShaderUniforms (main.ts tick) iterates the set.
type ShaderRef = { uniforms: Record<string, { value: unknown }> };
const _shaderRefs = new Set<ShaderRef>();

/**
 * Build the patched terrain material. Use exactly like a normal
 * `MeshLambertMaterial({ vertexColors: true })` — accepts vertex colors
 * as the base biome tint, then the shader patches add procedural detail.
 */
export function createTerrainMaterial(): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });

  // Wind direction comes from the same Tuning constant the heightmap uses,
  // so the ripple stripes visually align with the dune ridge orientation.
  const windDir = Tuning.DUNE_WIND_DIR_RAD;
  const windCos = Math.cos(windDir);
  const windSin = Math.sin(windDir);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindCos = { value: windCos };
    shader.uniforms.uWindSin = { value: windSin };
    // AAG — mirage uniforms. Updated per-frame in main.ts tick via
    // updateTerrainShaderUniforms. Initial values harmless (no wobble).
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uCameraPosXZ = { value: new THREE.Vector2(0, 0) };
    shader.uniforms.uSunHeight = { value: 0 };
    shader.uniforms.uCloudiness = { value: 0 };   // ACAH — cloud-shadow coverage (0..1)
    _shaderRefs.add(shader as unknown as ShaderRef);

    // ── Vertex shader: forward world position + WORLD-SPACE normal +
    //    per-vertex biome raw noise to the fragment stage.
    //
    // Critical: we need vWorldNormal NOT vNormal. Three.js's built-in
    // vNormal is in VIEW space (multiplied by normalMatrix), which
    // means its components fluctuate with camera angle. Looking
    // straight down at flat ground, world up-normal (0,1,0) becomes
    // (0, ~0, ~1) in view space — vNormal.y collapses to 0 and any
    // smoothstep(0.86, 0.99, vNormal.y) check returns 0, killing
    // flatness-gated effects. World-space normal stays (0,1,0) on
    // flat ground regardless of camera. Terrain has identity model
    // rotation so `normal` already IS the world-space normal — we
    // could skip the mat3 multiply, but it's correct in general.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        attribute float aBiomeRaw;
        varying vec3 vWorldPositionTerrain;
        varying vec3 vWorldNormal;
        varying float vBiomeRaw;
        uniform float uTime;
        uniform vec2 uCameraPosXZ;
        uniform float uSunHeight;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        vWorldPositionTerrain = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vBiomeRaw = aBiomeRaw;

        // AAG — salt-flat mirage. Vertical wobble on far salt-flat
        // vertices, animated, gated by sun height. Subtle — peak amp
        // ~0.18m at full effect. Reads as heat shimmer at the horizon
        // when looking across the salt pan at midday.
        float mirageDist = distance(vWorldPositionTerrain.xz, uCameraPosXZ);
        float mirageDistFactor = smoothstep(${Tuning.MIRAGE_NEAR_M.toFixed(1)}, ${Tuning.MIRAGE_FAR_M.toFixed(1)}, mirageDist);
        // Saltness: match the fragment's smoothstep window so the wobble
        // fades in over the same biome-boundary band as the visual cracks.
        float mirageSaltness = smoothstep(0.10, 0.54, aBiomeRaw);
        // Sun-height gate: invisible at night/dawn, peak at midday.
        float mirageSun = smoothstep(0.3, 0.9, uSunHeight);
        // Wobble: two crossed sin waves at different freqs, time-driven.
        float mirageWobble =
          sin(vWorldPositionTerrain.x * 0.30 + uTime * 3.0) *
          cos(vWorldPositionTerrain.z * 0.22 + uTime * 2.3);
        float mirageDisp = mirageWobble * ${Tuning.MIRAGE_AMP_M.toFixed(2)}
                         * mirageDistFactor * mirageSaltness * mirageSun;
        transformed.y += mirageDisp;
      `,
    );

    // ── Fragment shader: noise helpers + diffuseColor modulation ──
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPositionTerrain;
        varying vec3 vWorldNormal;
        varying float vBiomeRaw;
        uniform float uWindCos;
        uniform float uWindSin;
        uniform float uTime;        // ACAH — cloud-shadow drift
        uniform float uCloudiness;  // ACAH — cloud-shadow coverage

        // Hash → value-noise → 4-octave FBM. Precision-robust IQ-style
        // hash: pulls the input into [0, 1) via fract() BEFORE the
        // expensive arithmetic so the result stays well-distributed at
        // any world-coordinate scale.
        //
        // The naive fract(sin(dot(p,...)) * 43758.x) hash breaks at
        // large coords (~hundreds+): the sin() argument grows so large
        // that single-precision floats can't resolve small per-fragment
        // input deltas, and adjacent fragments end up hashing to the
        // SAME value. That manifested at the (356, 356) salt centroid
        // as completely-flat ground when the camera looked straight
        // down (small per-fragment XZ delta + large absolute coord =
        // total noise collapse). The IQ hash sidesteps the issue.
        ${iqNoise2D({ hash: 'terrainHash21', valueNoise: 'terrainValueNoise', fbm: 'terrainFbm', octaves: 4 })}

        // Voronoi (F2 - F1) — used for the salt-flat desiccation cracks.
        // Returns vec2(F1, F2). F2-F1 is small near cell edges, large
        // toward the cell interior. Cell centers are placed via the same
        // terrainHash so the pattern stays deterministic across reloads.
        vec2 terrainVoronoi(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float f1 = 8.0;
          float f2 = 8.0;
          for (int yi = -1; yi <= 1; yi++) {
            for (int xi = -1; xi <= 1; xi++) {
              vec2 offs = vec2(float(xi), float(yi));
              vec2 cellPoint = offs + vec2(
                terrainHash21(i + offs),
                terrainHash21(i + offs + vec2(13.7, 71.3))
              );
              float d = length(cellPoint - f);
              if (d < f1) { f2 = f1; f1 = d; }
              else if (d < f2) { f2 = d; }
            }
          }
          return vec2(f1, f2);
        }
      `,
    );

    // The `<color_fragment>` chunk is where diffuseColor first gets its
    // per-vertex / map color. We modulate AFTER that so our detail
    // multiplies the biome blend rather than replacing it. Lambert
    // lighting then operates on the modulated color.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>

        vec2 wxz = vWorldPositionTerrain.xz;


        // Biome-strength detection from the per-vertex raw biome noise
        // (interpolated to fragments via the vBiomeRaw varying). This is
        // the right input — using interpolated vertex color (a previous
        // approach) failed deep inside salt biome because nearby vertices
        // in the dune-salt blend zone dragged diffuseColor.b below the
        // salt threshold. Raw biome noise is unaffected by color blending.
        // Threshold matches Tuning.BIOME_THRESHOLD_SALT = 0.32 with a
        // smoothstep window equal to the color blend width (0.22) so
        // cracks ramp on at the same boundary the color does.
        float saltness = smoothstep(0.10, 0.54, vBiomeRaw);

        // Slope-derived constants reused by multiple effects. World-
        // space normal so the values stay correct regardless of camera
        // angle. (Using built-in vNormal here was the bug that hid the
        // crack pattern when looking straight down — view-space Y
        // collapsed to 0 on flat ground in down-look views.)
        float slope = 1.0 - vWorldNormal.y;               // 0 flat, 1 vertical
        float flatness = smoothstep(0.86, 0.99, vWorldNormal.y);

        // ============================================================
        // SAND DETAIL — dune + rocky biomes (weighted 1 - saltness)
        // ============================================================

        // Macro dune-color zones at ~30-50m scale — wind sorting
        // produces broad color regions (heavier iron-stained sand in
        // low spots, paler quartz on crests). Reads from far away.
        float macroZone = terrainFbm(wxz * 0.025);

        // Domain warping — feed displacement noise into the noise input
        // so the resulting pattern has organic, swirling color zones
        // instead of the uniform-cell look raw FBM gives.
        float warpA = terrainFbm(wxz * 0.40) - 0.5;
        float warpB = terrainFbm(wxz * 0.40 + vec2(7.1, 13.7)) - 0.5;
        vec2 warped = wxz + vec2(warpA, warpB) * 2.5;

        // Multi-scale grain layers.
        float coarseGrain = terrainFbm(warped * 0.12);   // ~8m color zones
        float fineGrain   = terrainFbm(warped * 1.5);    // ~0.67m grain
        float microGrain  = terrainFbm(wxz * 6.0);       // sub-meter detail (close-up)

        // Brightness mix from the three layers. Coarse + fine are
        // multiplicative; micro is a small additive tweak so it doesn't
        // wash out the larger scales. Macro adds wider regional shading.
        float sandBright = mix(0.92, 1.08, fineGrain)
                         * mix(0.94, 1.06, coarseGrain)
                         * mix(0.97, 1.03, microGrain)
                         * mix(0.96, 1.04, macroZone);

        // Color shift — warmer amber where the coarse grain is low (dips
        // hold heat), cooler/paler where it's high (wind-bleached crests).
        // Multiplicative tint so the effect compounds with brightness.
        vec3 sandWarm = vec3(1.08, 1.00, 0.88);
        vec3 sandCool = vec3(0.93, 0.96, 1.04);
        vec3 sandTint = mix(sandWarm, sandCool, smoothstep(0.30, 0.70, coarseGrain));

        // Macro zones additionally push the palette redder in low-noise
        // areas (iron sand) and paler in high-noise areas (quartz sand)
        // — visible at any distance, not just close up.
        vec3 sandIron  = vec3(1.06, 0.94, 0.85);
        vec3 sandPale  = vec3(1.00, 1.02, 1.04);
        vec3 macroTint = mix(sandIron, sandPale, smoothstep(0.35, 0.70, macroZone));
        sandTint *= macroTint;

        // Heterogeneous grain sparkle — sparse per-pixel hash throws
        // in occasional darker magnetite specks (~2% of grains),
        // rare iron-stained grains (~1.5%), and bright quartz catches
        // (~2%). Tuned down from a first pass that read more like
        // coffee grounds than fine sand — kept the variety but softened
        // the magnetite color and trimmed all three frequencies so the
        // ground reads as "lots of subtle variation" not "scattered
        // pebbles."
        float grainHash = terrainHash21(wxz * 28.0);
        vec3 grainSpeck = vec3(1.0);
        if (grainHash > 0.978) {
          grainSpeck = vec3(0.55, 0.50, 0.42);   // softer magnetite
        } else if (grainHash > 0.963) {
          grainSpeck = vec3(1.14, 0.85, 0.68);   // muted iron stain
        } else if (grainHash > 0.945) {
          grainSpeck = vec3(1.12, 1.10, 1.05);   // bright quartz catch
        }

        // Asymmetric scallop ripples — sine pattern with the negative
        // half compressed (gentler stoss / windward face) and the
        // positive half steepened (sharper lee/slip crests). Real
        // aeolian ripples are visibly asymmetric — straight sin made
        // them look like waves on water instead of sand.
        float u =  wxz.x * uWindCos + wxz.y * uWindSin;
        float v = -wxz.x * uWindSin + wxz.y * uWindCos;
        float scallop = terrainFbm(vec2(v * 0.08, u * 0.15)) - 0.5;
        float vWarp = v + scallop * 3.5;
        float rippleRaw = 0.5 + 0.5 * (
          0.7 * sin(vWarp * 0.35) +
          0.3 * sin(vWarp * 0.78 + 1.3)
        );
        // pow(r, 0.55) skews toward 1 — broad peaks, sharper troughs.
        // Bias the asymmetry direction with the wind sign so steep faces
        // sit on the lee side, gentle slopes on the stoss side.
        float rippleAsym = pow(rippleRaw, 0.55);
        // Ripples only register on near-flat ground (the natural place
        // for them to form). Amplitude bumped slightly for visibility.
        float rippleMod = mix(1.0, 0.92 + rippleAsym * 0.14, flatness);

        // Aeolian wind streaks — long thin streaks running ALONG the
        // wind direction (parallel, not perpendicular like ripples).
        // Two scales blended: primary streaks ~30m long, secondary
        // streaks ~8m for finer detail. v at low frequency stretches
        // the noise perpendicular to wind, producing long elongated
        // streak bands. Work on slopes too — wind blasts sand across
        // faces — so no flatness gate.
        float streakPrimary = terrainFbm(vec2(u * 0.03, v * 0.45));
        float streakSecondary = terrainFbm(vec2(u * 0.13, v * 1.20 + 7.0));
        float windStreak = mix(streakPrimary, streakSecondary, 0.35);
        // ±11% brightness — bumped from ±5% so streaks read at
        // mid-distance, not just up close.
        float windStreakMod = mix(0.89, 1.11, windStreak);
        // Color shift along streaks: high-streak (windward exposed)
        // pixels read slightly warmer/redder (sun-baked, iron sand
        // gets concentrated), low-streak (sheltered troughs) read
        // slightly cooler/paler. Multiplicative tint amplifies the
        // visual signal without overdoing the brightness.
        vec3 streakWarm = vec3(1.05, 0.99, 0.94);
        vec3 streakCool = vec3(0.96, 0.99, 1.03);
        vec3 windStreakTint = mix(streakCool, streakWarm, smoothstep(0.35, 0.65, windStreak));

        // Slip-face vs stoss-face — surfaces tilted INTO the wind
        // (windward / stoss) read darker + warmer (packed compact);
        // surfaces tilted AWAY (lee / slip) read lighter + cooler
        // (loose sand cascade). The horizontal slope direction comes
        // from the world normal's XZ projection.
        vec2 slopeDir = vec2(-vWorldNormal.x, -vWorldNormal.z);
        float slopeMag = length(slopeDir);
        vec2 windDir = vec2(uWindCos, uWindSin);
        float windFacing = (slopeMag > 0.001)
          ? dot(normalize(slopeDir), windDir)
          : 0.0;
        // -1 = pure lee, 0 = perpendicular, +1 = pure stoss.
        // Effect only on actually-sloped faces (slopeMag > ~0.1).
        float slopeWeight = smoothstep(0.10, 0.40, slopeMag);
        vec3 stossTint = vec3(0.94, 0.92, 0.88);    // packed darker
        vec3 leeTint   = vec3(1.04, 1.03, 1.00);    // looser lighter
        vec3 faceTint  = mix(vec3(1.0), mix(leeTint, stossTint, 0.5 + 0.5 * windFacing), slopeWeight);

        // Compose the sand modulation: brightness × tint × ripples
        // × wind streaks (brightness + tint) × grain speck × slip/
        // stoss face.
        vec3 sandMod = vec3(sandBright) * sandTint * rippleMod * windStreakMod * windStreakTint * grainSpeck * faceTint;
        float sandStrength = 1.0 - saltness;
        diffuseColor.rgb *= mix(vec3(1.0), sandMod, sandStrength);

        // ============================================================
        // SALT DESICCATION CRACKS — salt biome × flat surfaces
        // Multi-resolution: primary polygons + secondary sub-cracks.
        // Each crack network has per-cell width variation and the
        // crack zone gets an "edge curl" lighting reversal (slightly
        // brighter just inside the crack to mimic raised crust, then
        // darker right at the crack itself).
        // ============================================================

        // ---- Primary cracks (large polygons ~0.67m wide) ----
        vec2 cellWarp1 = vec2(
          terrainFbm(wxz * 0.6) - 0.5,
          terrainFbm(wxz * 0.6 + vec2(11.7, 5.3)) - 0.5
        ) * 1.5;
        vec2 cellPos1 = wxz * 1.5 + cellWarp1;
        vec2 vor1 = terrainVoronoi(cellPos1);
        float edge1 = vor1.y - vor1.x;
        // Per-cell crack width — some cells have wide cracks (deep
        // dried plates), others thin (newer/healed cracks). Varies
        // the smoothstep threshold from 0.05 to 0.12.
        float cellId1 = terrainHash21(floor(cellPos1));
        float crackWidth1 = mix(0.05, 0.12, cellId1);
        float crack1 = 1.0 - smoothstep(0.0, crackWidth1, edge1);
        // Edge curl — a small band JUST INSIDE the crack zone lights
        // up a bit (raised crust catches sun), then darkens fully
        // inside the crack itself. Reads as a 3D-like rim around
        // each polygon edge.
        float curl1 = smoothstep(crackWidth1 * 1.6, crackWidth1 * 0.9, edge1)
                    - smoothstep(crackWidth1 * 0.9, 0.0, edge1);
        float cellBright1 = mix(0.90, 1.10, cellId1);

        // ---- Secondary cracks (sub-polygons ~0.22m wide, half-strength) ----
        // Real desiccation often has finer cracks WITHIN larger plates.
        // We use a different warp seed + 3× scale so secondaries don't
        // align with primaries.
        vec2 cellWarp2 = vec2(
          terrainFbm(wxz * 1.8 + vec2(3.1, 17.9)) - 0.5,
          terrainFbm(wxz * 1.8 + vec2(23.5, 9.1)) - 0.5
        ) * 0.6;
        vec2 cellPos2 = wxz * 4.5 + cellWarp2;
        vec2 vor2 = terrainVoronoi(cellPos2);
        float edge2 = vor2.y - vor2.x;
        // Secondary cracks always narrow + shallower than primary.
        float crack2 = 1.0 - smoothstep(0.0, 0.06, edge2);
        // Secondaries SUPPRESSED inside primary cracks (no double-darkening).
        crack2 *= 1.0 - crack1;

        // ---- Wet-zone patches — low-freq noise creates patches of
        //      slightly darker / cooler salt suggesting moisture intrusion
        //      near groundwater. Patches ~15m across. ----
        float wetNoise = terrainFbm(wxz * 0.07 + vec2(31.0, 47.0));
        float wetMask = smoothstep(0.55, 0.75, wetNoise);   // ~25% of the surface
        vec3 wetTint = vec3(0.78, 0.82, 0.88);              // darker + slightly blue

        // ---- Salt crystal sparkle — sparse bright pixels for
        //      individual halite crystals catching the sun. ----
        float crystalHash = terrainHash21(wxz * 35.0);
        vec3 crystalSpeck = (crystalHash > 0.985)
          ? vec3(1.18, 1.18, 1.16)
          : vec3(1.0);

        // ---- Compose salt modulation ----
        // Brightness: primary cell bright + curl rim brighten + crack darken.
        float saltBright = cellBright1
                         * (1.0 + curl1 * 0.18)               // raised-rim highlight
                         * mix(1.0, 0.42, crack1)              // primary crack shadow
                         * mix(1.0, 0.62, crack2);             // secondary crack shadow
        // Apply wet-zone tint multiplicatively.
        vec3 saltTint = mix(vec3(1.0), wetTint, wetMask);
        vec3 saltMod = vec3(saltBright) * saltTint * crystalSpeck;

        // Mask: only apply on actual salt biome AND on flat surfaces.
        float saltStrength = saltness * flatness;
        diffuseColor.rgb *= mix(vec3(1.0), saltMod, saltStrength);

        // ROCKY BIOME — no biome-specific texture. The sand-detail
        // block above already runs on rocky (gated on 1 - saltness),
        // giving the same grain + ripple + wind streaks. The natural
        // dark-brown rocky vertex color carries the visual difference
        // from dune. The "rocky" character comes from scattered rock
        // geometry on the ground (see rockScatter.ts) — not from a
        // shader pattern. A previous Voronoi-fissure approach (D63?)
        // read too similarly to the salt-flat crack pattern, so it
        // was removed and replaced with the rock-scatter scheme.

        // ============================================================
        // SLOPE EFFECTS — apply across all biomes
        // ============================================================

        // Steep faces darken (suggests exposed grit / weathering shadow).
        float slopeDarken = mix(1.0, 0.70, smoothstep(0.30, 0.80, slope));
        diffuseColor.rgb *= slopeDarken;

        // Steep faces also push cooler/desaturated, reading as a
        // different material from the warm flat sand.
        float coolPush = smoothstep(0.40, 0.85, slope) * 0.20;
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * vec3(0.85, 0.88, 0.95),
          coolPush
        );

        // ── ACAH — MOVING CLOUD SHADOWS. Dapple the ground where the overcast
        //    cloud field is dense. Sampled from low-freq value-noise at world XZ
        //    drifting over time (so the patches crawl like the sky's clouds),
        //    gated by uCloudiness so it only appears under cloud cover. Reuses
        //    the terrain's own precision-robust noise. Subtle — overcast already
        //    dims the SUN globally (lighting.ts); this adds the moving dapple.
        if (uCloudiness > 0.001) {
          vec2 cloudUV = vWorldPositionTerrain.xz * ${Tuning.CLOUD_SHADOW_SCALE.toFixed(4)}
                       + uTime * vec2(${Tuning.CLOUD_SHADOW_DRIFT_X.toFixed(4)}, ${Tuning.CLOUD_SHADOW_DRIFT_Z.toFixed(4)});
          float cloudN = terrainValueNoise(cloudUV) * 0.6 + terrainValueNoise(cloudUV * 0.42 + 11.0) * 0.4;
          float cloudShadow = smoothstep(0.42, 0.74, cloudN) * uCloudiness;
          diffuseColor.rgb *= mix(1.0, ${Tuning.CLOUD_SHADOW_DARKEN.toFixed(3)}, cloudShadow);
        }
      `,
    );
  };

  return mat;
}

/** AAG — per-frame mirage uniform update. Called from main.ts tick.
 *  Pushes `time.elapsed`, the camera's XZ position, and the current
 *  `time.sunHeight` to every registered terrain-material shader so the
 *  mirage wobble animates and gates correctly. */
export function updateTerrainShaderUniforms(
  time: number,
  cameraX: number,
  cameraZ: number,
  sunHeight: number,
  cloudiness: number,
): void {
  for (const s of _shaderRefs) {
    const u = s.uniforms;
    if (u.uTime) (u.uTime as { value: number }).value = time;
    if (u.uCameraPosXZ) {
      const v = (u.uCameraPosXZ as { value: THREE.Vector2 }).value;
      v.set(cameraX, cameraZ);
    }
    if (u.uSunHeight) (u.uSunHeight as { value: number }).value = sunHeight;
    if (u.uCloudiness) (u.uCloudiness as { value: number }).value = cloudiness;
  }
}
