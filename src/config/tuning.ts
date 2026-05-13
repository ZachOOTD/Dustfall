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

  // Day/night
  DAY_LENGTH_SECONDS: 360,  // one in-game day = 6 real minutes
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
  HEAT_GAIN_PER_SEC: 1 / 90,
  HEAT_COOL_PER_SEC: 1 / 40,
  DEHYDRATION_DAMAGE: 1 / 30,
  HEATSTROKE_DAMAGE: 1 / 25,

  // Atmosphere
  FOG_NEAR: 25,
  FOG_FAR: 170,
  WORLD_RADIUS: 280,

  // Sky module
  SKY_SPHERE_RADIUS: 480,
  SUN_DISC_DISTANCE: 400,
  SUN_DISC_SIZE: 22,

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
