// All magic numbers live here. Adjust to change game feel.

import * as THREE from 'three';

export const Tuning = {
  // Player
  PLAYER_HEIGHT: 1.7,                // total capsule height = 2R + 2hH
  PLAYER_CAPSULE_HALF_HEIGHT: 0.5,   // cylindrical part halved
  PLAYER_CAPSULE_RADIUS: 0.35,
  PLAYER_EYE_OFFSET: 0.85,           // camera Y above body center
  WALK_SPEED: 4.2,
  SPRINT_MULTIPLIER: 1.7,
  JUMP_VELOCITY: 7.0,                // m/s upward kick on jump (~1m apex)
  CROUCH_EYE_OFFSET: 0.40,           // camera Y above body center while crouched
  CROUCH_SPEED_MULTIPLIER: 0.5,      // walk speed * this while crouched

  // Debug — flip back to false before any "real" play test.
  GOD_MODE: true,                    // never dies; die() floors stats instead

  // Day/night
  DAY_LENGTH_SECONDS: 480,  // Session U — was 360 (6 real min); now 8 real min
  START_DAY_TIME: 0.34,     // ~08:00 — sun reasonably high at spawn

  // Sun & lighting
  SUN_INTENSITY_MAX: 1.55,
  AMBIENT_DAY_GAIN: 0.55,
  AMBIENT_NIGHT_GAIN: 0.10,
  AMBIENT_BASE: 0.18,
  MOON_INTENSITY_MAX: 0.40,
  // Shadow camera (in world units, ortho bounds around the player)
  SHADOW_CAM_HALF: 60,
  SHADOW_CAM_NEAR: 1,
  SHADOW_CAM_FAR: 300,
  SHADOW_MAP_SIZE: 2048,
  SUN_DISTANCE: 100,        // how far the directional light sits from its target
  /** Landmarks placed beyond this distance from origin won't cast shadows
   *  (fog hides their shadows anyway and they make up the bulk of the cost). */
  SHADOW_CULL_DISTANCE: 80,

  // Stats
  THIRST_DRAIN_PER_SEC: 1 / 300, // idle death in ~5 min
  THIRST_SPRINT_FACTOR: 2.2,
  THIRST_HEAT_FACTOR: 1.8,
  HEAT_GAIN_PER_SEC: 1 / 90,         // positive temperature gain in sun
  HEAT_COOL_PER_SEC: 1 / 40,         // shelter cooling on positive side
  DEHYDRATION_DAMAGE: 1 / 30,
  HEATSTROKE_DAMAGE: 1 / 25,
  // Hunger
  HUNGER_DRAIN_PER_SEC: 1 / 600,     // ~10 min to starve from full
  HUNGER_STARVATION_DAMAGE: 1 / 40,
  // Stamina (controller.ts ticks it)
  STAMINA_DRAIN_SPRINT: 1 / 6,       // 6s of sprint at full
  STAMINA_RECOVER_PER_SEC: 1 / 9,    // 9s recovery from empty
  STAMINA_SPRINT_THRESHOLD: 0.05,    // can't initiate sprint below this
  // Cold (negative side of temperature)
  COLD_NIGHT_DRAIN: 1 / 120,         // at night without shelter
  COLD_SHELTER_RECOVER: 1 / 30,      // recover toward 0 in shelter
  COLD_DAMAGE_PER_SEC: 1 / 35,       // when temperature ≤ -1
  // Canteen (container)
  CANTEEN_DRINK_DELTA: 0.25,         // fillLevel consumed per drink

  // Atmosphere
  FOG_NEAR: 25,                       // legacy linear-fog values (kept for reference)
  FOG_FAR: 170,
  // Session BB-4 — FogExp2 density curve. Clear days feel open (low
  // density), storm peak chokes visibility to ~30m. Density follows
  // an eased curve from CLEAR→STORM as weather.intensity ramps.
  FOG_DENSITY_CLEAR: 0.0035,
  FOG_DENSITY_STORM: 0.055,
  WORLD_RADIUS: 280,

  // Hover speeder (Session CC) — dynamic-body bike, velocity-controlled
  // for both Y (hover) and XZ (movement). Bike yaw lerps toward the
  // camera's yaw so steering is "where you look"; A/D strafe lateral.
  // Movement is comfortable arcade: top speed 14 m/s (~50 km/h), 1s to
  // ramp up under hold, smooth deceleration on release.
  SPEEDER_HOVER_HEIGHT: 1.2,
  SPEEDER_HOVER_K_P: 35,
  SPEEDER_HOVER_K_D: 14,
  SPEEDER_DENSITY: 50,
  SPEEDER_MAX_SPEED: 14,                // m/s — forward + reverse cap
  SPEEDER_STRAFE_SPEED: 7,              // m/s — half forward speed
  SPEEDER_REVERSE_MULT: 0.55,           // S thrust = forward × this
  SPEEDER_BOOST_MULT: 1.7,              // Shift while moving → max speed × this
  SPEEDER_ACCEL_LERP: 0.07,             // per-frame lerp toward target XZ velocity (~14 frames to reach 64%)
  SPEEDER_TURN_RATE_MAX: 3.0,           // rad/s cap on bike yaw rate
  SPEEDER_TURN_RESPONSE: 4.0,           // target_ang_vel = wrapped_yaw_err × this (proportional)
  SPEEDER_TURN_LERP: 0.30,              // per-frame lerp toward target ang vel (snappier than linear lerp)
  SPEEDER_LINEAR_DAMP: 0,               // disabled — velocity is fully driven
  SPEEDER_ANGULAR_DAMP: 0,              // disabled — angvel is fully driven
  SPEEDER_HOP_IMPULSE: 1800,
  SPEEDER_MOUNT_RANGE: 3.5,
  SPEEDER_DISMOUNT_OFFSET: 1.8,
  SPEEDER_RIDER_SEAT_X: 0,              // local rider offset relative to bike center
  SPEEDER_RIDER_SEAT_Y: 1.45,           // well above the handlebars (bars are at body-Y ~0.5)
  SPEEDER_RIDER_SEAT_Z: 0.35,           // slightly behind center (cockpit position)

  // Storm visuals (Session BB-4)
  // Near/mid/far dust layer particle counts. Mid keeps the old 2500;
  // near + far stack to give parallax depth.
  STORM_DUST_NEAR_COUNT: 800,
  STORM_DUST_MID_COUNT: 2500,
  STORM_DUST_FAR_COUNT: 600,
  STORM_DUST_NEAR_SPREAD: 30,
  STORM_DUST_MID_SPREAD: 90,
  STORM_DUST_FAR_SPREAD: 200,
  // Layer-staggered opacity ramps so dust appears far-first then closes
  // in. Each pair = [intensity at which layer starts, intensity at full].
  STORM_NEAR_RAMP_LO: 0.15,
  STORM_NEAR_RAMP_HI: 0.55,
  STORM_FAR_RAMP_LO: 0.0,
  STORM_FAR_RAMP_HI: 0.35,
  // Peak opacity per layer.
  STORM_DUST_NEAR_OPACITY: 0.55,
  STORM_DUST_MID_OPACITY: 0.55,
  STORM_DUST_FAR_OPACITY: 0.40,
  // Terrain darkening at peak storm. Sun intensity × (1 - STORM_SUN_DIM),
  // ambient × (1 - STORM_AMBIENT_DIM). Sun loses more than ambient (sun
  // is "behind" the dust, ambient picks up dust-scattered light).
  STORM_SUN_DIM: 0.65,
  STORM_AMBIENT_DIM: 0.20,
  // Vignette tint + intensity at peak storm.
  STORM_VIGNETTE_HEX: 0x6e3a22,
  STORM_VIGNETTE_MAX_OPACITY: 0.55,
  STORM_VIGNETTE_INNER: 0.30,        // alpha=0 inside this normalized radius
  STORM_VIGNETTE_OUTER: 0.85,        // alpha=full beyond this radius

  // Dune terrain (Session P) — ridged + wind-warped noise.
  // Ridges run perpendicular to the wind direction; aniso < 1 elongates them.
  // Asymmetry biases ridge crests in the wind direction (steeper leeward face).
  DUNE_WIND_DIR_RAD: 0.62,             // ~36° from +X; world-fixed prevailing wind
  DUNE_ANISO_RATIO: 0.28,              // <1 = ridges elongate perpendicular to wind
  DUNE_RIDGE_SCALE_PRIMARY: 170,       // primary dune wavelength, meters
  DUNE_RIDGE_SCALE_SECONDARY: 42,      // smaller ripples riding the primary ridges
  DUNE_PRIMARY_AMP: 13.5,              // peak height contribution of primary ridges
  DUNE_SECONDARY_AMP: 1.9,             // smaller ridges on top
  DUNE_BASE_UNDULATION_AMP: 2.8,       // low-frequency ground-level wobble
  DUNE_BASE_UNDULATION_SCALE: 360,
  DUNE_ASYMMETRY_AMOUNT: 26.0,         // organic u-warp (m); curves ridges
  DUNE_WARP_SCALE: 420,                // wavelength of the warp noise channel

  // Biomes (Session P)
  BIOME_NOISE_FREQ: 1 / 220,           // ~220m wavelength → big regions
  BIOME_THRESHOLD_ROCKY: -0.22,        // noise < this → rocky
  BIOME_THRESHOLD_SALT: 0.32,          // noise > this → salt; in-between → dune
  // Per-biome terrain-height multiplier. Salt flats are nearly featureless;
  // rocky biomes are subtly more rugged than dunes.
  BIOME_HEIGHT_SCALE_DUNE: 1.0,
  BIOME_HEIGHT_SCALE_ROCKY: 1.15,
  BIOME_HEIGHT_SCALE_SALT: 0.08,

  // Wreck palette (Session S). Cool grey-rust industrial; avoids pure
  // blacks/whites so primitives feel weathered, not cartoon.
  WRECK_HULL_HEX: 0x5f5b54,            // weathered light grey hull
  WRECK_HULL_DARK_HEX: 0x3a3631,       // shadowed/buried hull undersides
  WRECK_RUST_HEX: 0x6e3a22,            // dominant rust accent
  WRECK_RUST_DARK_HEX: 0x4a2614,       // deep-rust crevice color
  WRECK_NOZZLE_INTERIOR_HEX: 0x14110e, // engine bell inside — near black
  WRECK_NOZZLE_RIM_HEX: 0x4a4944,      // cooler metal rim
  WRECK_ANTENNA_HEX: 0x2a2620,         // antenna struts / wires

  // Sky module
  SKY_SPHERE_RADIUS: 480,
  SUN_DISC_DISTANCE: 400,
  SUN_DISC_SIZE: 22,
  // Session V — moon, stars, shooting stars, distant planet
  MOON_DISC_SIZE: 16,
  MOON_DISC_DISTANCE: 400,
  STAR_COUNT: 800,
  STAR_SPHERE_RADIUS: 460,            // just inside sky sphere
  SHOOTING_STAR_POOL: 4,
  SHOOTING_STAR_MIN_INTERVAL: 4,      // seconds, scaled inversely with nightMix
  SHOOTING_STAR_MAX_INTERVAL: 12,
  SHOOTING_STAR_LIFETIME_MIN: 0.8,
  SHOOTING_STAR_LIFETIME_MAX: 1.6,
  PLANET_DISTANCE: 420,
  PLANET_SIZE: 14,
  // Fixed direction: low on the eastern horizon (azimuth ~+X, elev ~0.18)
  PLANET_DIR_X: 0.985,
  PLANET_DIR_Y: 0.18,
  PLANET_DIR_Z: -0.04,

  // Ambient dust (Session V) — toned-down sandstorm-style drift, always on.
  AMBIENT_DUST_COUNT: 400,
  AMBIENT_DUST_SPREAD: 40,
  AMBIENT_DUST_OPACITY: 0.10,
  AMBIENT_DUST_SUPPRESS_STORM: 0.15,  // hide above this storm intensity

  // Scene
  FOV: 78,
  NEAR_PLANE: 0.1,
  FAR_PLANE: 600,
  RNG_SEED: 1337,
  LANDMARK_COUNT: 180,

  // Pickups
  CANTEEN_COUNT: 35,
  CANTEEN_THIRST_RESTORE: 0.32,
  CANTEEN_PICKUP_RADIUS: 1.6,

  // First-person viewmodel — hands + held item offset from camera (local space)
  VIEWMODEL_OFFSET_X: 0.32,
  VIEWMODEL_OFFSET_Y: -0.34,
  VIEWMODEL_OFFSET_Z: -0.55,
  // Per-item use-anim durations (seconds)
  VIEWMODEL_CANTEEN_ANIM_S: 1.2,
  VIEWMODEL_MACHETE_ANIM_S: 0.4,
  VIEWMODEL_BANDAGE_ANIM_S: 0.8,

  // Idle breath (Session Q) — slow vertical sine on the viewmodel Y so the
  // held item gently rises and falls when the player is still.
  BREATH_AMPLITUDE: 0.012, // meters
  BREATH_FREQUENCY: 0.35,  // Hz

  // Footstep proximity check (Session Q) — within this distance to any
  // waterSource, footsteps play the wet/splash variant.
  FOOTSTEP_WET_RADIUS: 2.0,

  // Footprint decals (Session Y) — InstancedMesh pools, alpha fade over time.
  // Player prints fire at the existing footstep cadence (controller.ts);
  // lizard tracks fire every cadence-meters of flee travel (lizard.ts).
  FOOTPRINT_LIFETIME_S: 45,             // total visible age before recycle
  FOOTPRINT_FADE_TAIL_S: 12,            // final smoothstep fade window
  FOOTPRINT_OFFSET_Y: 0.04,             // meters above terrain (avoid z-fight)
  FOOTPRINT_LATERAL_OFFSET: 0.16,       // L/R foot displacement perpendicular to walk dir
  FOOTPRINT_PLAYER_POOL: 200,
  FOOTPRINT_PLAYER_SIZE_X: 0.22,        // lateral (boot width)
  FOOTPRINT_PLAYER_SIZE_Z: 0.36,        // forward (boot length)
  FOOTPRINT_PLAYER_TOEOUT_RAD: 0.10,    // ~6° toe-out per side for natural gait
  FOOTPRINT_COLOR_PLAYER_HEX: 0x2d1f12, // dark earth — reads as darker on light sand
  FOOTPRINT_LIZARD_POOL: 240,
  FOOTPRINT_LIZARD_SIZE_X: 0.10,
  FOOTPRINT_LIZARD_SIZE_Z: 0.12,
  FOOTPRINT_LIZARD_CADENCE_M: 0.30,     // tracks every X meters during flee
  FOOTPRINT_LIZARD_COLOR_HEX: 0x1e1208, // very dark — small but visible

  // Stone-well rework (Session Z) — wells confined to salt-flats biome.
  // Visual: ring of perturbed icosahedra stones + an askew wooden plank hatch.
  WELL_TARGET_COUNT: 5,                 // try to place this many; salt may give fewer
  WELL_RING_RADIUS: 0.78,               // center-to-stone radius (m)
  WELL_STONE_COUNT: 9,
  WELL_STONE_SIZE: 0.30,                // base radius of each perturbed icosahedron
  WELL_STONE_LIGHT_HEX: 0x9a8a6e,       // pale weathered stone
  WELL_STONE_DARK_HEX: 0x6c5a44,        // deeper stone (alternates around ring)
  WELL_HATCH_PLANK_COUNT: 5,
  WELL_HATCH_THICKNESS: 0.05,           // plank Y-thickness (m)
  WELL_WOOD_HEX: 0x6b4a2c,              // sun-bleached desert wood
  WELL_WOOD_DARK_HEX: 0x4a3220,         // shadow / weathered side

  // Tactile salvage panels (Session Z) — small access plate on each wreck
  // replaces the "raycast hits any mesh" salvage trigger. Each wreck
  // constructor sets a kind-specific local offset; placeholder default fits
  // most. Panel = small dark plate with a brighter rim/handle for affordance.
  SALVAGE_PANEL_SIZE_X: 0.32,           // width (m)
  SALVAGE_PANEL_SIZE_Y: 0.24,           // height
  SALVAGE_PANEL_SIZE_Z: 0.06,           // depth (sticks out from hull)
  SALVAGE_PANEL_BODY_HEX: 0x2a2622,     // dark metal plate
  SALVAGE_PANEL_RIM_HEX: 0xa28860,      // warm brass rim — visible affordance

  // Torch + flashlight (Session AA) — light sources for night gameplay.
  // Torch is consumable (single burn cycle), flashlight is rechargeable
  // (passive recharge while held + off).
  TORCH_BURN_DURATION_S: 180,           // 3 real-minute burn before consumed
  TORCH_LIGHT_DISTANCE: 12,             // PointLight `distance` falloff
  TORCH_LIGHT_INTENSITY: 1.8,           // mean — flickers ±0.4 each frame
  TORCH_LIGHT_FLICKER_AMP: 0.4,
  TORCH_LIGHT_COLOR_HEX: 0xffb060,      // warm orange flame

  FLASHLIGHT_DRAIN_DURATION_S: 120,     // 2 real-min from full to empty when lit
  FLASHLIGHT_RECHARGE_DURATION_S: 180,  // 3 real-min from empty to full when off
  FLASHLIGHT_LIGHT_DISTANCE: 25,
  FLASHLIGHT_LIGHT_INTENSITY: 3.0,
  FLASHLIGHT_LIGHT_ANGLE_RAD: 0.45,     // SpotLight `angle` — narrow beam
  FLASHLIGHT_LIGHT_PENUMBRA: 0.3,
  FLASHLIGHT_LIGHT_COLOR_HEX: 0xe4f0ff, // cool white
} as const;

// Sky gradient colors (top vs horizon) per time of day. Horizon stays close to
// the existing fog/background palette so distant landmarks blend smoothly.
export const SkyColors = {
  DAY: new THREE.Color(0xd6a368),    // (legacy — used as horizon at midday)
  DUSK: new THREE.Color(0xb24e2a),
  NIGHT: new THREE.Color(0x0a0e1a),

  HORIZON_DAY: new THREE.Color(0xe2b582),
  HORIZON_DUSK: new THREE.Color(0xa83820),
  HORIZON_NIGHT: new THREE.Color(0x080a14),

  TOP_DAY: new THREE.Color(0x6c8aa8),       // dusty blue-grey
  TOP_DUSK: new THREE.Color(0x352038),      // muted plum
  TOP_NIGHT: new THREE.Color(0x02030a),     // near black
} as const;

// Sun disc colors — pale at noon, warm at golden hour.
export const SunColors = {
  NOON: new THREE.Color(0xfff0d0),
  GOLDEN: new THREE.Color(0xff9e5c),
  HORIZON: new THREE.Color(0xff6840),
} as const;
