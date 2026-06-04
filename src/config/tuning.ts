// All magic numbers live here. Adjust to change game feel.

import * as THREE from 'three';

export const Tuning = {
  // Player
  PLAYER_HEIGHT: 1.7,                // total capsule height = 2R + 2hH
  PLAYER_CAPSULE_HALF_HEIGHT: 0.5,   // cylindrical part halved
  PLAYER_CAPSULE_RADIUS: 0.35,
  PLAYER_EYE_OFFSET: 0.85,           // camera Y above body center
  WALK_SPEED: 6.0,                   // JJ-2 — bumped 4.2 → 6.0 (felt sluggish in playtest)
  SPRINT_MULTIPLIER: 2.2,             // JJ-2 — bumped 1.7 → 2.2 (sprint = 13.2 m/s)
  JUMP_VELOCITY: 7.0,                // m/s upward kick on jump (~1m apex)
  CROUCH_EYE_OFFSET: 0.40,           // camera Y above body center while crouched
  CROUCH_SPEED_MULTIPLIER: 0.5,      // walk speed * this while crouched

  // Debug — flip back to false before any "real" play test.
  GOD_MODE: true,                    // never dies; die() floors stats instead
  DEBUG_STARTER_LOADOUT: false,      // AAV — flipped to false; regular NEW GAME starts empty. DEV MODE title-menu button sets the localStorage flag to override and apply the starter loadout for testing.
  DEBUG_UNLIMITED_STAMINA: true,     // JJ-2 — skip sprint stamina drain so testing isn't gated on rest

  // Day/night
  DAY_LENGTH_SECONDS: 720,  // CC-4 — was 480 (8 min); now 12 min for less rushed pacing
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
  // ABL — perf: 2048 → 1024 cuts shadow-pass fill rate by 4x. The art
  // style is low-mid-fi flatshaded; shadow edges go from sharp to
  // slightly soft, which actually reads BETTER for our atmospheric
  // tone (sharp shadows on dunes look gamey). Big perf win toward 144fps.
  SHADOW_MAP_SIZE: 1024,
  // ABL — shadow update cadence in frames. autoUpdate=true regens the
  // shadow map every frame. Sun moves slowly (DAY_LENGTH_SECONDS=720
  // → sun sweeps 360° per 12min real = 0.5°/sec). Updating shadows
  // every 6 frames (~10Hz) is invisibly different but cuts shadow
  // work to 1/6. Set in main.ts via renderer.shadowMap.autoUpdate=false
  // + per-frame counter.
  SHADOW_UPDATE_EVERY_N_FRAMES: 6,
  SUN_DISTANCE: 100,        // how far the directional light sits from its target
  /** Landmarks placed beyond this distance from origin won't cast shadows
   *  (fog hides their shadows anyway and they make up the bulk of the cost). */
  SHADOW_CULL_DISTANCE: 120,  // EE — bumped from 80 with the larger world

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
  CANTEEN_DRINK_DELTA: 0.25,         // fillLevel consumed per drink (Q-key single-gulp)
  // Session UU — hold-LMB sustained drinking. Time between automatic
  // "gulps" while LMB is held with the canteen wielded. Each gulp drains
  // CANTEEN_DRINK_DELTA (or remaining fill if less) and restores thirst
  // proportionally. 0.7s gives an intentional cadence — not instant, not
  // sluggish. See src/player/wieldAction.ts.
  CANTEEN_DRINK_INTERVAL_S: 0.7,

  // Session UU (D75) — distance ahead of the player where placed kits
  // land (fire_kit, tent_kit, sled_kit). Replaces the 1.5m local constant
  // in fire.ts and the 2.2m locals in tent.ts / sled.ts. 2.2m places the
  // kit just outside arm's reach, at the edge of where the player would
  // expect to walk INTO the fire's shelter zone.
  PLACEMENT_DISTANCE_M: 2.2,

  // Session VV — fire entity constants (lifted from src/world/fire.ts).
  FIRE_INITIAL_FUEL_S: 90,           // burn time on fresh-kit deploy
  FIRE_FUEL_PER_BRANCH_S: 30,        // burn time added per branch
  FIRE_SHELTER_RADIUS_M: 2.2,        // shelter zone half-extent X/Z
  FIRE_SHELTER_HEIGHT_M: 1.5,        // shelter zone half-extent Y
  // Session AAM — grill attachment dimensions + multi-cook capacity.
  FIRE_GRILL_WIDTH_M: 0.55,          // grate span across X
  FIRE_GRILL_DEPTH_M: 0.45,          // grate span across Z
  FIRE_GRILL_HEIGHT_M: 0.45,         // grate Y above fire base
  FIRE_GRILL_BAR_RADIUS_M: 0.012,    // iron bar thickness
  FIRE_GRILL_MAX_PARALLEL_COOKS: 4,  // how many items can cook simultaneously on a gridded fire
  FIRE_NEAR_DISTANCE_SQ: 1.5 * 1.5,  // reject deploy within sqrt(this)m of another fire

  // Session VV — tent entity constants (lifted from src/world/tent.ts).
  TENT_SHELTER_HALF_X: 1.8,
  TENT_SHELTER_HALF_Y: 1.4,
  TENT_SHELTER_HALF_Z: 1.8,
  TENT_NEAR_DISTANCE_SQ: 2.0 * 2.0,  // reject deploy within 2m of another tent
  // AAZ-fix — small-tent visual constants. Geometry mirrors the AAY/AAZ
  // large tent (peaked ridge along the long axis, sagged side walls,
  // guy ropes) but scaled down for a one-person pup tent. The shelter
  // zone above is wider than the visual — the player sleeps NEXT to
  // the tent, not inside it, so the bubble extends past the mesh.
  TENT_LENGTH_M: 2.2,                  // along the ridge (long axis)
  TENT_BASE_WIDTH_M: 1.55,              // base-to-base across (short axis)
  TENT_RIDGE_HEIGHT_M: 1.15,            // ridge peak height
  TENT_POLE_PROTRUDE_M: 0.20,           // ridge poles stick this far above the apex
  TENT_GUY_REACH_M: 0.90,                // distance from base corner to ground stake
  TENT_ROOF_SAG_M: 0.18,                 // catenary dip at the center of each slanted wall
  TENT_PATCH_COUNT_UNUSED: 0,            // patch system removed (AAZ-polish)

  // Session WW — low-stat warning vignettes (cold = blue, thirst = brown).
  // Cloned from stormVignette pattern but lives in CSS overlay-land
  // (HUD-tier, not atmosphere) so it doesn't tone-map with the renderer.
  COLD_VIGNETTE_THRESHOLD: 0.3,        // temperature below this triggers blue tint
  THIRST_VIGNETTE_THRESHOLD: 0.25,     // thirst below this triggers brown tint
  STAT_VIGNETTE_MAX_OPACITY: 0.35,     // peak opacity at stat=0
  // (colors hardcoded in statVignette.ts CSS since they're tone-locked)

  // Session WW — low-stamina screen wobble. Sin-driven sub-cm camera
  // jitter that mirrors the sandworm-tremor pattern in scale + shape.
  STAMINA_WOBBLE_THRESHOLD: 0.2,       // stamina below this starts wobble
  STAMINA_WOBBLE_MAX_M: 0.04,          // peak amplitude (meters)
  STAMINA_WOBBLE_FREQ_HZ: 6,           // shake cadence

  // Session XX — larger enterable tent. Frame ~3.5×2.5×2.2m; walls and
  // roof colliders; front face is open for walk-in entry.
  LARGE_TENT_WIDTH_M: 3.5,
  LARGE_TENT_DEPTH_M: 2.5,
  LARGE_TENT_HEIGHT_M: 2.2,
  // Shelter zone covers the interior cavity (smaller than the tent's
  // external footprint — the player must actually be inside).
  LARGE_TENT_SHELTER_HALF_X: 1.5,
  LARGE_TENT_SHELTER_HALF_Y: 1.0,
  LARGE_TENT_SHELTER_HALF_Z: 1.0,
  LARGE_TENT_NEAR_DISTANCE_SQ: 4.0 * 4.0,  // reject deploy within 4m of another large tent
  // Session YY — storm "perceived intensity" multiplier when player is
  // inside a large tent. 0.4 = 40% of authoritative storm intensity
  // visible (dust + screen vignette dampened) while fog + stats stay
  // on the world-truth intensity. Reads as "I'm sheltered but I can
  // see the storm through the open front." Small tents + fires use the
  // legacy 0 (fully shielded) — D79.
  LARGE_TENT_STORM_DAMPEN: 0.4,
  // Session AAY — Bedouin-style tent visual constants. The shelter zone
  // dimensions above are unchanged (gameplay-stable); these drive the
  // peaked-roof + ridge-pole + guy-rope geometry that replaces the
  // pre-AAY featureless box.
  LARGE_TENT_SIDE_WALL_H_M: 1.55,        // vertical wall height before roof slope begins
  LARGE_TENT_RIDGE_PEAK_Y_M: 2.55,       // ridge apex (above floor) — taller than legacy 2.2 to read as "peaked"
  LARGE_TENT_POLE_PROTRUDE_M: 0.40,      // how far ridge poles stick up above the apex
  LARGE_TENT_POLE_RADIUS_M: 0.05,        // ridge / corner pole radius
  LARGE_TENT_GUY_REACH_M: 1.10,          // distance from tent footprint to ground stake
  LARGE_TENT_GUY_RADIUS_M: 0.015,        // rope cylinder radius
  LARGE_TENT_STAKE_H_M: 0.18,            // ground stake length (tip pokes up ~0.12m)
  LARGE_TENT_PATCH_COUNT: 7,             // weathered patches scattered on the canvas
  // AAZ — visual polish: off-white canvas + cloth sag + operational doorway.
  // Sag amounts bumped substantially in the second polish pass — wrinkles
  // were dropped entirely (set to 0) because they read as noise more than
  // texture. The catenary droop is now the primary "this is heavy cloth"
  // signal, so it needs to be large enough to actually deflect the
  // silhouette in the screenshot.
  LARGE_TENT_ROOF_SAG_M: 0.32,           // catenary dip at the center of each roof panel — ~16% of the 2m slant length, visibly droopy
  LARGE_TENT_WALL_BOW_M: 0.14,           // outward bow of the walls at mid-span — visible "pulled between poles" silhouette
  LARGE_TENT_FABRIC_WRINKLE_M: 0,        // per-vertex wrinkle amplitude — disabled (read as noise, not fabric texture)
  LARGE_TENT_DOOR_ANIM_SPEED: 2.4,       // door open/close lerp speed (1/s) — full transition in ~0.42s

  // Atmosphere
  FOG_NEAR: 25,                       // legacy linear-fog values (kept for reference)
  FOG_FAR: 170,
  // Session BB-4 — FogExp2 density curve. Clear days feel open (low
  // density), storm peak chokes visibility to ~30m. Density follows
  // an eased curve from CLEAR→STORM as weather.intensity ramps.
  FOG_DENSITY_CLEAR: 0.0018,  // EE — tightened so 1km+ remains visible in the larger world
  FOG_DENSITY_STORM: 0.055,
  WORLD_RADIUS: 900,  // EE — soft visibility cap; was 280 for the 800m world

  // World chunks (Session EE — world rework #1). The terrain is a
  // TERRAIN_CHUNK_GRID × TERRAIN_CHUNK_GRID grid of TERRAIN_CHUNK_SIZE-meter
  // heightfield chunks, total world span = SIZE * GRID. Each chunk reuses
  // the previous 192-cell-per-side resolution (~4.17m grid) so per-chunk
  // visual fidelity is identical to the pre-EE 800m world.
  WORLD_SIZE: 2400,
  TERRAIN_CHUNK_SIZE: 800,
  TERRAIN_CHUNK_GRID: 3,
  TERRAIN_CHUNK_CELLS: 192,
  // (HH — TERRAIN_LOD_OUTER_RADIUS / TERRAIN_LOD_CELLS removed. The FF far-LOD
  // ring caused a visible "second terrain" floating above the chunks in dune
  // valleys; fog at the chunk-band edge serves as the visible horizon now.)

  // Hover speeder (Session CC) — dynamic-body bike, velocity-controlled
  // for both Y (hover) and XZ (movement). Bike yaw lerps toward the
  // camera's yaw so steering is "where you look"; A/D strafe lateral.
  // Movement is comfortable arcade: top speed 14 m/s (~50 km/h), 1s to
  // ramp up under hold, smooth deceleration on release.
  SPEEDER_HOVER_HEIGHT: 1.2,
  SPEEDER_HOVER_K_P: 55,                // proportional gain (×0.1 inside the controller, so effective gain 5.5)
  SPEEDER_HOVER_VY_MAX: 12,             // m/s — max upward/downward target velocity (was 8; catches up dune slopes faster). AAL — SPEEDER_HOVER_K_D removed; unused since BB-CC velocity-control switch.
  // Terrain look-ahead — sample N points along the bike's velocity
  // vector and take MAX(terrain) so the bike anticipates dunes ahead
  // and rises BEFORE the slope. Times in seconds; spacing roughly
  // even from 0 to LOOKAHEAD_T.
  SPEEDER_HOVER_LOOKAHEAD_T: 0.45,      // total lookahead time
  SPEEDER_HOVER_LOOKAHEAD_SAMPLES: 4,   // including current position (0/dt/2dt/3dt)
  SPEEDER_DENSITY: 50,
  SPEEDER_MAX_SPEED: 14,                // m/s — forward + reverse cap
  SPEEDER_STRAFE_SPEED: 7,              // m/s — half forward speed
  SPEEDER_REVERSE_MULT: 0.55,           // S thrust = forward × this
  SPEEDER_BOOST_MULT: 1.7,              // Shift while moving → max speed × this
  // ACW C7/C8 — speeder dust trail + engine-ignition glow FX.
  SPEEDER_DUST_MIN_SPEED: 2.0,          // m/s — below this no dust kicks up
  SPEEDER_DUST_PER_FRAME: 3,            // particles emitted/frame at speed (scales up to ~2× on boost)
  SPEEDER_DUST_BACK_OFFSET: 1.7,        // m behind the bike center the dust spawns
  SPEEDER_DUST_DOWN_OFFSET: 0.5,        // m below the bike center (toward the ground wash)
  SPEEDER_GLOW_MAX_INTENSITY: 3.2,      // engine nozzle PointLight intensity at full throttle
  SPEEDER_GLOW_HOT_HEX: 0xff7a2a,       // nozzle interior color at full throttle (hot orange)
  // ACX — mounted 3P chase camera (behind the rider, looking forward).
  SPEEDER_3P_CAM_BACK: 3.4,             // m behind the bike along the camera's forward
  SPEEDER_3P_CAM_ANCHOR_UP: 0.9,        // m above the rig seat for the chase anchor
  SPEEDER_3P_CAM_ABOVE: 0.5,            // extra m up so the cam looks slightly down at the bike
  SPEEDER_ACCEL_LERP: 0.07,             // per-frame lerp toward target XZ velocity (~14 frames to reach 64%)
  SPEEDER_TURN_RATE_MAX: 3.0,           // rad/s cap on bike yaw rate
  SPEEDER_TURN_RESPONSE: 4.0,           // target_ang_vel = wrapped_yaw_err × this (proportional)
  SPEEDER_TURN_LERP: 0.30,              // per-frame lerp toward target ang vel (snappier than linear lerp)
  SPEEDER_LINEAR_DAMP: 0,               // disabled — velocity is fully driven
  SPEEDER_ANGULAR_DAMP: 0,              // disabled — angvel is fully driven
  // Session ABA — UNMOUNTED damping. Body-friction-free hover bike,
  // when bumped by the player capsule, accumulates linear + angular
  // velocity it never sheds (Rapier dynamic body with damp=0 +
  // no ground contact). Apply exponential-decay damping only while
  // unmounted; mounted state has input-driven setLinvel/setAngvel
  // that fully override these. Frame-rate-independent: vNew = v *
  // exp(-rate*dt). Angular damps faster than linear because a
  // spinning parked bike reads more wrong than a drifting one.
  SPEEDER_UNMOUNTED_LINEAR_DAMP_RATE_PER_S: 1.8,    // ~0.4 m/s remaining after 1s from 3 m/s bump
  SPEEDER_UNMOUNTED_ANGULAR_DAMP_RATE_PER_S: 2.5,   // ~0.08 rad/s remaining after 1s from 1 rad/s spin
  // AAL — SPEEDER_HOP_IMPULSE removed; unused since CC-2 (jump replaced with 2-phase pulse/recover).
  SPEEDER_MOUNT_RANGE: 3.5,
  // ACQ — E only mounts when the player is roughly LOOKING at the bike (not on
  // proximity alone). dot(camForwardXZ, dirToBikeXZ) must exceed this. 0.5 ≈
  // within ~60° of facing the bike.
  SPEEDER_MOUNT_LOOK_DOT: 0.5,
  SPEEDER_DISMOUNT_OFFSET: 1.8,
  SPEEDER_RIDER_SEAT_X: 0,              // local rider offset relative to bike center
  SPEEDER_RIDER_SEAT_Y: 1.00,           // mid-height (CC-2) — sees over handlebars (Y≈0.42) without floating
  SPEEDER_RIDER_SEAT_Z: 0.55,           // over the sunken cockpit seat (CC-2 redesign moved the seat back)
  // ACV #148 — where the 3P RIG (not the camera) sits on the bike while mounted.
  // The rig.group origin is the feet/ground plane, so SEAT_Y is offset DOWN from
  // the camera seat so the seated hips land on the cockpit seat + feet reach the
  // pegs. Foreground-tunable (mounted-3P view): nudge Y/Z until the figure sits
  // cleanly astride the bike rather than floating above / sunk into it.
  SPEEDER_RIG_SEAT_Y: -0.35,            // group-origin Y relative to bike center
  SPEEDER_RIG_SEAT_Z: 0.36,             // back on the seat (as far as the ~0.65m arm still reaches the bars)

  // CC-2 — tilt on input (visual-only, bike body's rotation is X+Z-locked
  // per D34). Pitch from W/S, roll from A/D. Camera rolls half as much
  // so the world doesn't tumble.
  SPEEDER_TILT_PITCH_MAX: 0.14,         // rad (~8°) nose-down under full forward thrust
  SPEEDER_TILT_ROLL_MAX: 0.21,          // rad (~12°) lean into strafe
  SPEEDER_TILT_LERP: 0.12,              // per-frame lerp toward target tilt
  SPEEDER_CAM_ROLL_RATIO: 0.5,          // camera rolls this fraction of bike roll

  // CC-2 — 2-phase jump. CC-2.3: pulse vy DECAYS linearly from
  // JUMP_PULSE_VY → 0 over PULSE_DUR (smooths the rise toward the peak
  // instead of forcing constant upward vy then hitting a wall); recover
  // uses a slower lerp so the transition from "rising" to "falling at
  // -VY_MIN" is gradual, not a hard pivot at the top.
  SPEEDER_JUMP_PULSE_VY: 18,            // m/s peak upward target (start of pulse)
  SPEEDER_JUMP_PULSE_DUR: 0.30,         // longer pulse → more gradual rise
  SPEEDER_JUMP_RECOVER_DUR: 1.6,        // seconds of slow-descent recovery
  SPEEDER_JUMP_RECOVER_VY_MIN: -2,      // m/s descent cap (softer than -3)
  SPEEDER_JUMP_RECOVER_LERP: 0.08,      // vs the normal hover lerp 0.25 — much gentler transition through peak

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
  // AAA — start of the smoothstep ramp on perceivedIntensity. Pre-AAA
  // was 0.4 (vignette only inside the upper half of storm range), but
  // YY+ZZ's perceivedIntensity split capped large-tent shelter at 0.4
  // — meaning the vignette NEVER fired inside the open-front cabin.
  // Lowered to 0.3 so partial-shelter still shows some vignette presence.
  STORM_VIGNETTE_RAMP_START: 0.3,

  // Session AAB — opening wreck skylight god-rays. Additive cone visible
  // from the 30° stress-fracture slice gap (slices 17+18 omitted; RR+SS).
  // The beam tip sits at the gap on the upper hull; the base spreads
  // outward to roughly the floor width. Intensity scales with sunHeight
  // so the beam is invisible at night and peaks at high sun.
  // AAL — 6 godray constants deleted (AAB feature removed in AAJ; "kept for
  // documentation" turned out to be permanent debt). If re-introducing a
  // skylight beam, start fresh — the original values are in the AAB
  // changelog entry if needed.

  // Session AAC — craftable home placeables.
  // Bedroll — low-profile cloth pad on the ground. Small shelter zone
  // (gives partial cold-drain protection while sleeping but isn't a
  // full tent). Pack-up always works (no inside-the-shelter refuse —
  // it's flat ground geometry, not enclosing).
  BEDROLL_WIDTH_M: 1.6,                  // long axis (head-to-foot)
  BEDROLL_DEPTH_M: 0.7,                  // short axis (shoulder-to-shoulder)
  BEDROLL_SHELTER_HALF_X: 0.9,
  BEDROLL_SHELTER_HALF_Y: 0.6,
  BEDROLL_SHELTER_HALF_Z: 0.5,
  BEDROLL_NEAR_DISTANCE_SQ: 1.2 * 1.2,   // reject deploy within 1.2m of another bedroll
  // Lantern — standing post + glass globe + PointLight. Never burns out.
  // Flicker amp small enough to feel organic without being distracting.
  LANTERN_HEIGHT_M: 1.1,                 // total height (post + globe)
  LANTERN_LIGHT_INTENSITY: 1.6,
  LANTERN_LIGHT_DISTANCE: 14,            // attenuation radius
  LANTERN_LIGHT_COLOR_HEX: 0xffc080,     // warm yellow-orange
  LANTERN_FLICKER_AMP: 0.10,             // intensity multiplier amplitude
  LANTERN_NEAR_DISTANCE_SQ: 1.0 * 1.0,
  // Locker — wooden chest. Bidirectional storage; pack-up refuses if
  // contents are non-empty.
  LOCKER_WIDTH_M: 1.0,
  LOCKER_DEPTH_M: 0.6,
  LOCKER_HEIGHT_M: 0.7,
  LOCKER_NEAR_DISTANCE_SQ: 1.5 * 1.5,

  // Session ACE — craftable world-anchor stake (B1 Phase 3).
  STAKE_NEAR_DISTANCE_SQ: 0.5 * 0.5,     // reject deploy within 0.5m of another stake
  /** Distance (m) the player must be within to attach/detach rope on a
   *  stake. Tighter than typical interaction range so the stake doesn't
   *  trigger from across a sled deck. */
  STAKE_ROPE_ATTACH_DISTANCE: 2.5,
  // ACQ — rope-loop ring local offset on the stake visual (stake.ts), shared
  // with rope.ts resolveEndpointWorldPos so the rope connects to the actual
  // ring. X = ring tube touches the shaft +X surface; Y = seated under the cap.
  STAKE_LOOP_OFFSET_X: 0.044,
  STAKE_LOOP_OFFSET_Y: 0.58,

  // Session AAE — creature companion (Rocky-inspired from Project Hail Mary).
  // Pentagonal-symmetric body with 5 radial legs. Two locomotion states:
  // rolling (legs retracted, body rolls) for fast follow at distance;
  // walking (legs out, upright) for close-range. Idle at very close.
  COMPANION_BODY_RADIUS: 0.20,           // ~0.4m diameter creature
  COMPANION_LEG_LENGTH: 0.14,            // restored to original short value (per user feedback)
  // AAZ-fix — leg-lift mechanic switched from translating the pivot
  // upward (legs slid as a unit under the body) to rotating each leg
  // around its body-attachment hinge. To keep the legs SHORT (per user
  // request) AND have their tips reach the ground, the attachment is
  // moved BELOW the body equator: pivot Y = LL·sin(rest) puts the leg
  // tip on the ground at the resting down-angle. With LL=0.14 and
  // rest=0.795rad (~46°), the pivot sits ~10cm above ground (=R·0.5)
  // on the sphere surface, and the leg extends 14cm outward + downward
  // to touch ground. Pre-AAZ-fix attached at the equator (R=20cm above
  // ground) where 14cm legs couldn't span the drop — tips floated.
  COMPANION_LEG_REST_ANGLE_RAD: 0.795,   // down-angle at rest (tip touches ground)
  COMPANION_LEG_LIFT_ANGLE_RAD: 0.45,    // walk-gait peak lift amplitude (rotation toward horizontal)
  COMPANION_COLOR_HEX: 0xb04030,         // deep coral red — pops against sand
  COMPANION_DARK_COLOR_HEX: 0x6e2818,    // shadow tone on alternating facets
  COMPANION_ROLLING_SPEED_M_S: 5.5,      // sprint follow
  COMPANION_WALKING_SPEED_M_S: 1.8,      // close-range stride
  COMPANION_CLOSE_DISTANCE_M: 2.0,       // < this = idle (chill out)
  COMPANION_FAR_DISTANCE_M: 6.0,         // > this = roll to catch up
  COMPANION_FOLLOW_OFFSET_M: 1.5,        // target sits this far BESIDE the player (not on top)
  COMPANION_IDLE_BOB_AMP: 0.04,          // breathing-style body bob amplitude
  COMPANION_IDLE_BOB_FREQ_HZ: 1.2,       // breathing rate
  COMPANION_LEG_GAIT_FREQ_HZ: 4.0,       // legs sin-wave when walking
  COMPANION_LEG_GAIT_AMP: 0.06,          // peak leg lift while walking
  // AAO — storm-peak huddle. When `ctx.weather.intensity` exceeds this,
  // the companion overrides any far/walk/idle behavior and presses to
  // the ground with legs tucked. ±0.05 hysteresis applied in
  // updateCompanion so we don't flicker at the threshold.
  COMPANION_HUDDLE_THRESHOLD: 0.80,

  // AAO — dead-tree scatter feel knobs (rule-2 lift from deadTree.ts
  // module-locals). Values unchanged from pre-AAO behaviour.
  DEAD_TREE_FLATNESS_THRESHOLD: 0.7,     // reject candidate if local |dY| > this over 1.5m
  DEAD_TREE_BRANCH_COUNT_MIN: 2,         // pickups per tree (lower bound)
  DEAD_TREE_BRANCH_COUNT_MAX: 4,         // (upper bound, inclusive)
  DEAD_TREE_BRANCH_RING_RADIUS_MIN: 1.5, // branches scatter in [min, max] ring at base
  DEAD_TREE_BRANCH_RING_RADIUS_MAX: 3.0,

  // Session AAF — "the long storm" — 7-day escalating-storm endgame.
  // Storm interval shrinks + duration grows over 7 days of survival.
  // Day 7+ = permanent dust-choked endgame state. Player can survive
  // but must stay sheltered most of the time.
  LONG_STORM_DAY: 7,                  // daysSurvived at which the long storm hits
  STORM_INTERVAL_DAY0_MIN: 360,       // 6 min minimum calm at day 0
  STORM_INTERVAL_DAY0_MAX: 600,       // 10 min maximum
  STORM_INTERVAL_DAY7_MIN: 60,        // 1 min minimum calm just before doom
  STORM_INTERVAL_DAY7_MAX: 180,       // 3 min maximum
  STORM_DURATION_DAY0_S: 90,          // 1.5 min storm at day 0
  STORM_DURATION_DAY7_S: 300,         // 5 min storm just before doom
  // Post-LONG_STORM_DAY: storms are nearly back-to-back.
  LONG_STORM_INTERVAL_MIN: 30,
  LONG_STORM_INTERVAL_MAX: 90,
  LONG_STORM_DURATION_S: 480,         // 8 min storms

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

  // Biomes (Session P; GG — rescaled for 2400m world)
  BIOME_NOISE_FREQ: 1 / 900,           // GG — 1/220 → 1/900; vast biome regions (~2.67 per 2400m axis)
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
  WRECK_HULL_DARK_HEX: 0x534f48,       // AAM-followup #10: was 0x3a3631 (~40% darker than base, creating strong "fan blade" stripes on the sliced lathe hull as alternating slices read as separate panels with shadow gaps). Bumped much closer to base so slice seams read as subtle panel joints, not contrasted blades. User feedback: the opening wreck's rear dome looked thin/segmented because the high-contrast stripes were misread as gaps.
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
  MOON_DISC_SIZE: 32,                 // larger crescent (was 16 full disc)
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
  // ACO — fade the ambient tan drift OUT at night so the stars read + the
  // night feels calm. Daylight factor from ctx.time.sunHeight (-1..1): fully
  // gone at/below LO (sun below horizon), full by HI (well into day).
  AMBIENT_DUST_NIGHT_FADE_LO: 0.02,   // sunHeight ≤ this → dust fully hidden (night)
  AMBIENT_DUST_NIGHT_FADE_HI: 0.20,   // sunHeight ≥ this → dust at full day opacity

  // Session AAG — fine dust motes (complementary to ambientDust).
  // Bone-warm white, smaller particles, persists through storms until
  // intensity > 0.8. Motes visibly catch lantern/fire/sun light because
  // their near-white color stands out only where lighting brightens
  // surrounding surfaces (no shader required — pure visual contrast).
  DUST_MOTES_COUNT: 120,
  DUST_MOTES_SPREAD: 25,
  DUST_MOTES_OPACITY: 0.22,        // AAH: was 0.18 — too easily missed; 0.22 reads in lit interiors

  // AAH — dust-motes storm cross-fade window. Hard cut at 0.8 (AAG)
  // is jarring; smoothstep 0.7→0.9 cross-fades into ambientDust's
  // peak-storm dominance instead of popping out.
  DUST_MOTES_STORM_FADE_START: 0.7,
  DUST_MOTES_STORM_FADE_END: 0.9,

  // Session AAG — salt-flat mirage shader. Vertex-level wobble on the
  // existing terrain mesh — subtle Y displacement gated by distance from
  // camera + saltness + sun height. Reads as heat-haze shimmer at the
  // horizon when looking across salt flats at midday.
  MIRAGE_NEAR_M: 10,      // AAH: was 15. closer ramp-in so wobble reads on the immediate horizon when walking salt-flats
  MIRAGE_FAR_M: 80,       // beyond this = peak wobble
  MIRAGE_AMP_M: 0.18,     // peak vertex Y displacement

  // Session AAG / AAH — footprint puffs. Small upward dust burst on each
  // footstep. Constants lifted from src/world/footprintPuffs.ts in AAH
  // (CLAUDE.md rule 2 — magic numbers in tuning.ts only). AAH bumped
  // VERTICAL_VEL 0.6 → 0.9 — original peak height v²/(2g) = 15cm was
  // barely above foot; 0.9 lands ~34cm peak which reads clearly.
  FOOTPRINT_PUFF_COUNT: 60,        // particle-pool capacity
  FOOTPRINT_PUFF_PER_PUFF: 5,      // particles emitted per footstep
  FOOTPRINT_PUFF_LIFE_S: 0.6,      // particle lifespan
  FOOTPRINT_PUFF_VERTICAL_VEL: 0.9,// m/s upward at spawn (AAH: was 0.6)
  FOOTPRINT_PUFF_LATERAL_VEL: 0.25,// ±m/s lateral drift
  FOOTPRINT_PUFF_GRAVITY: 1.2,     // m/s² downward

  // Session AAH — inventory swap-on-pickup-full. Hold E this long on a
  // pickup with full bag + non-empty selected slot to drop the slot
  // and take the pickup. Lifted from interaction.ts (was a module-local
  // const). AAH tuned 1.5 → 1.2 for a touch snappier "hold and move
  // on" rhythm; longer than salvage (1.0s), shorter than the original.
  PICKUP_SWAP_DURATION_S: 1.2,

  // Scene
  FOV: 78,
  NEAR_PLANE: 0.1,
  FAR_PLANE: 1800,  // EE — bumped from 600 with the larger world
  RNG_SEED: 1337,
  // (legacy LANDMARK_COUNT removed in GG — was never read; hero landmark
  // count now lives below in HERO_LANDMARK_COUNT_MIN/MAX.)

  // AAL — loot container drop balance (was hardcoded in lootContainers.ts:38).
  // entries-per-container: random 1..max. Drop bucket boundaries: bandage <
  // BANDAGE, cloth < CLOTH, scrap < SCRAP, canteen < CANTEEN, else machete.
  // Tune to shift player progression pacing (more healing vs. more crafting
  // material vs. more weapons).
  LOOT_CONTAINER_ENTRIES_MIN: 1,
  LOOT_CONTAINER_ENTRIES_MAX: 3,
  LOOT_CONTAINER_BANDAGE_THRESHOLD: 0.25,   // 0..0.25 → bandage (25%)
  LOOT_CONTAINER_CLOTH_THRESHOLD: 0.55,     // 0.25..0.55 → cloth (30%)
  LOOT_CONTAINER_SCRAP_THRESHOLD: 0.75,     // 0.55..0.75 → scrap (20%)
  LOOT_CONTAINER_CANTEEN_THRESHOLD: 0.92,   // 0.75..0.92 → canteen (17%)
  // remaining 0.92..1.0 → machete (8% rare drop)
  LOOT_CONTAINER_CLOTH_COUNT_MAX: 2,        // 1 + rand() * this
  LOOT_CONTAINER_SCRAP_COUNT_MAX: 3,        // 1 + rand() * this
  LOOT_CONTAINER_CANTEEN_FILL_MIN: 0.3,     // 0.3..0.8 fill level on loot canteens
  LOOT_CONTAINER_CANTEEN_FILL_RANGE: 0.5,

  // Scatter — world rework #2 (Session GG). All bounds + counts rescaled
  // for the 2400m world; chunk bounds are [-1200, +1200] so 1100m radial
  // sampling stays safely inside the chunk band.
  CACTUS_TARGET_COUNT: 14,          // AAI: was 10 — density bump for procgen worlds
  CACTUS_SCATTER_RADIUS_MIN: 12,
  CACTUS_SCATTER_RADIUS_MAX: 1100,
  // JJ — cluster cacti into patches around salt-biome centroids (was uniform scatter).
  // JJ-2 — spread across multiple salt regions (2-3 cacti per region) instead of
  // packing all 10 into one tight patch.
  CACTUS_PATCH_COUNT: 4,
  CACTUS_PATCH_CLUSTER_RADIUS: 12,       // m — rejection-sample cacti within this of each centroid
  CACTUS_PATCH_MIN_SEPARATION: 300,      // m — greedy exclusion between patch centroids
  DEAD_TREE_TARGET_COUNT: 45,       // AAI: was 30 — density bump for procgen worlds
  DEAD_TREE_SCATTER_RADIUS_MIN: 20,
  DEAD_TREE_SCATTER_RADIUS_MAX: 1100,
  // JJ — cluster dead trees into groves around salt-biome centroids (was uniform scatter).
  // JJ-2 — split spawn between dense groves (~60%) and sporadic uniform scatter
  // (~40%) across salt regions, for a more organic mix of "thicket" + "lone tree".
  TREE_GROVE_COUNT: 3,
  TREE_PER_GROVE: 6,                     // 3 groves × 6 trees = 18 clustered; remainder (12) scattered
  TREE_GROVE_CLUSTER_RADIUS: 40,         // m — rejection-sample trees within this of each centroid
  TREE_GROVE_MIN_SEPARATION: 500,        // m — greedy exclusion between grove centroids
  HERO_LANDMARK_COUNT_MIN: 15,
  HERO_LANDMARK_COUNT_MAX: 20,
  HERO_LANDMARK_RADIUS_MIN: 70,
  HERO_LANDMARK_RADIUS_MAX: 1050,
  WELL_MIN_SEPARATION: 400,            // greedy exclusion radius for multi-well placement
  BIOME_CENTROID_SEARCH_RADIUS: 1100,  // grid sweep half-extent in findBiomeCentroid
  BIOME_CENTROID_GRID_STEP: 24,        // sample spacing in findBiomeCentroid

  // Procgen POIs — Session HH (world rework #3). Augments the 6 hand-
  // placed anchor POIs with ~15 wrecks scattered across the world via
  // rejection sampling with min-separation enforcement (Poisson-disk
  // character at this density). Vocabulary is the existing wreck kinds —
  // no new art.
  POI_PROCGEN_COUNT: 22,               // AAI: was 15 — density bump for procgen worlds
  POI_MIN_SEPARATION: 250,             // m — rejection-sample min distance between any two POIs
  POI_MAX_PLACEMENT_TRIES: 80,         // per-target attempt budget
  POI_SCATTER_RADIUS_MIN: 120,         // m — leave room for spawn cluster + anchor POIs
  POI_SCATTER_RADIUS_MAX: 1100,        // m — safely inside chunk band
  // Session ABA — share of procgen POIs that use the new composite
  // wreck system (procgenWreck.ts) vs. the legacy hand-modeled
  // wreck-kind palette. Session ABC bumped 0.35 → 0.50 after the part
  // vocabulary expanded (3 → 5 hullSegment variants, 2 → 3 wreck classes
  // with gunship added, breach-patch decoration layer wired into 2 of the
  // hull variants). At 0.50 ~11 of 22 procgen POIs per world get
  // composites; the rest stay on legacy engine_cluster / fuselage /
  // escape_pod / cargo_container. Ramp again past 0.65 once a multi-seed
  // playtest validates that the expanded variety doesn't read repetitive.
  PROCGEN_COMPOSITE_SHARE: 0.50,

  // AAI — opening-scene anchor (player + opening wreck + companion pod +
  // speeder). Per D83, this position stays seed-stable as a narrative anchor.
  // PLAYER_SPAWN_EXCLUSION_RADIUS keeps procgen flagships + procgen wrecks
  // out of the immediate viewshed so the opening cinematic isn't crowded.
  OPENING_SCENE_ANCHOR_X: -50,
  OPENING_SCENE_ANCHOR_Z: 0,
  PLAYER_SPAWN_EXCLUSION_RADIUS: 80,   // m — no procgen wrecks within this of anchor

  // AAK — multi-seed playtest of AAI surfaced three issues:
  //  (1) flagships landing past 1km from origin → undiscoverable in normal play.
  //  (2) a 60m-long mega_ship spawning ~108m from player spawn → dominated
  //      the opening view (seed 99999 in the AAK harness).
  //  (3) flagships ending up on steep dune slopes (roughness > 1.0) → awkward
  //      tilts despite mega_ship/mega_wreck's per-spawn flat-spot drift.
  // Flagship-specific guards (separate from the procgen-wreck constants).
  // Flagships ship as hero-tier landmarks; the player should be able to
  // discover them via medium-range exploration without trekking to the
  // chunk-band edge.
  FLAGSHIP_SCATTER_RADIUS_MIN: 200,    // m — past the spawn exclusion AND past immediate sight
  FLAGSHIP_SCATTER_RADIUS_MAX: 800,    // m — tightened from POI_SCATTER_RADIUS_MAX 1100; keeps flagships in a discoverable band
  FLAGSHIP_SPAWN_EXCLUSION_RADIUS: 200,// m — larger than PLAYER_SPAWN_EXCLUSION_RADIUS so big flagships don't loom over the opening
  FLAGSHIP_MAX_ROUGHNESS: 0.7,         // average per-meter terrain height delta in a 5m patch (flat=0, steep dune slope ~1.2)

  // Lizard procgen — Session HH. Replaces 4 hard-coded spawns with
  // density-based scatter that clusters near POIs + sparse global density.
  // Salt biome rejected (lizards don't live on featureless flats).
  LIZARD_TARGET_COUNT: 28,
  LIZARD_PER_POI_AVG: 1.5,             // average lizards clustered per POI (1 or 2 each)
  LIZARD_CLUSTER_RADIUS_MIN: 8,        // m — min offset of clustered lizard from POI center
  LIZARD_CLUSTER_RADIUS_MAX: 20,       // m — max offset of clustered lizard from POI center
  LIZARD_SCATTER_RADIUS_MAX: 1100,     // m — global-pass scatter outer bound
  LIZARD_SPAWN_BUFFER_FROM_ORIGIN: 25, // m — keep player spawn area un-ambushy

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
  // Session PP — weapon variants
  VIEWMODEL_PIPE_STAFF_ANIM_S: 0.7,    // slow heavy swing
  VIEWMODEL_SCRAP_GUN_ANIM_S: 0.3,     // sharp recoil
  VIEWMODEL_SCRAP_BULLET_ANIM_S: 0.6,  // reload pantomime
  // Weapon mechanic specs — combat.ts looks these up via the equipped ItemId.
  // MACHETE keeps the historical numbers from inline combat.ts constants
  // (hardcoded SWING_RANGE=1.8, DAMAGE=0.45, COOLDOWN=0.5).
  WEAPON_MACHETE_RANGE: 1.8,
  WEAPON_MACHETE_DAMAGE: 0.45,
  WEAPON_MACHETE_COOLDOWN: 0.5,
  // PIPE STAFF — slower, longer reach, knockback. Lizard (1 HP) still dies
  // in one hit; sandworm (12 HP) takes 12 swings same as machete but each
  // swing knocks the worm back ~3m (only meaningful on small enemies).
  WEAPON_PIPE_STAFF_RANGE: 2.6,
  WEAPON_PIPE_STAFF_DAMAGE: 0.55,
  WEAPON_PIPE_STAFF_COOLDOWN: 0.85,
  WEAPON_PIPE_STAFF_KNOCKBACK_M: 3.0,
  // SCRAP GUN — ranged raycast, single big hit, finite ammo. Damage 1.5
  // one-shots lizards and chunks 12.5% off a sandworm per shot. 4 starting
  // rounds; reload by consuming a scrap_bullet item.
  WEAPON_SCRAP_GUN_RANGE: 30.0,
  WEAPON_SCRAP_GUN_DAMAGE: 1.5,
  WEAPON_SCRAP_GUN_COOLDOWN: 1.2,
  WEAPON_SCRAP_GUN_MAX_AMMO: 6,
  // ENERGY PISTOL — charge-up ranged. Hold LMB to charge over
  // CHARGE_TIME seconds; release to fire. Damage scales from
  // MIN_DAMAGE (tap fire) to MAX_DAMAGE (fully charged). 0.3s
  // post-fire cooldown — fast. No ammo (sci-fi energy weapon).
  // Range slightly shorter than scrap_gun (18m vs 30m).
  WEAPON_ENERGY_PISTOL_RANGE: 18.0,
  WEAPON_ENERGY_PISTOL_MIN_DAMAGE: 0.50,
  WEAPON_ENERGY_PISTOL_MAX_DAMAGE: 2.00,
  WEAPON_ENERGY_PISTOL_CHARGE_TIME: 1.2,
  WEAPON_ENERGY_PISTOL_COOLDOWN: 0.3,
  VIEWMODEL_ENERGY_PISTOL_ANIM_S: 0.35,

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
  // ACC playtest — sled drag tracks. Wider than footprints (matches
  // sled deck width); short Z dimension so consecutive decals tile
  // into a continuous trail. Pool sized to ~160m of trail before
  // recycling (160 / 0.4 = 400 decals would be max but we'll cap
  // lower since the fade lifetime recycles older ones automatically).
  // ACC playtest — pool bumped 240 → 600 to accommodate the much
  // denser cadence below. At cadence 0.12m + walk speed ~4 m/s, this
  // covers ~18 sec of trail before recycling — most of the 45s fade
  // lifetime, so the player sees a long history behind them.
  FOOTPRINT_SLED_POOL: 600,
  FOOTPRINT_SLED_SIZE_X: 0.7,           // lateral — matches the flat center of the curled deck
  FOOTPRINT_SLED_SIZE_Z: 0.6,           // forward chunk
  // ACC playtest — cadence dropped 0.30 → 0.12 so consecutive gaussian
  // peaks are well inside each other's falloff. Each pixel of trail is
  // now covered by ~5 overlapping decals; their gaussian profiles sum
  // to a smooth continuous depression with no visible periodic peaks.
  FOOTPRINT_SLED_CADENCE_M: 0.12,
  FOOTPRINT_SLED_COLOR_HEX: 0x6e5236,   // ACV #187 — lightened (was 0x3d2918 dark brown; read too heavy/dark). A paler sun-warmed sand tone reads as a shallow drag scuff, not a black gouge.


  // Stone-well rework (Session Z) — wells confined to salt-flats biome.
  // Visual: ring of perturbed icosahedra stones + an askew wooden plank hatch.
  WELL_TARGET_COUNT: 3,                 // GG — one per major salt region in the 2400m world
  WELL_RING_RADIUS: 0.78,               // center-to-stone radius (m)
  WELL_STONE_COUNT: 9,                  // stones per ring
  WELL_STONE_RINGS: 3,                  // CC-4 — stacked vertically (chest-high well)
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
  // AAU — panel proportions redesigned for "house access panel" feel:
  // taller-than-wide rectangle, ~70cm tall × 45cm wide × 20cm deep.
  // Body is now recessed INTO the hull (RECESS_DEPTH controls how
  // deep) so only the rim + door read proud of the hull surface
  // when closed. AAR was 0.55×0.55×0.18 (square fuse-box); felt
  // small + stuck-on at oblique angles.
  SALVAGE_PANEL_SIZE_X: 0.45,           // width (m)
  SALVAGE_PANEL_SIZE_Y: 0.70,           // height — taller than wide for access-panel proportions
  SALVAGE_PANEL_SIZE_Z: 0.20,           // depth — total cavity depth into the hull
  SALVAGE_PANEL_RECESS_DEPTH: 0.16,     // how much of the body is sunken into the hull surface
  SALVAGE_PANEL_DOOR_OPEN_ANGLE: 2.1,   // rad — door swings ~120° on hinges
  SALVAGE_PANEL_PRY_DURATION_S: 0.85,   // hold-LMB duration to lever the door open
  // AAU — slowed door lerp 4.5 → 3.0/s so the swing-open animation is
  // visibly readable. At 3.0/s the door reaches target in ~1.5s,
  // which is enough time for the player to see the swing rather than
  // perceiving it as "instant pop."
  SALVAGE_PANEL_DOOR_OPEN_LERP: 3.0,
  // ACY — dynamic panel placement on procgen wrecks. `findPanelMount`
  // raycasts a jittered grid against a part's outward flanks to find a flat,
  // outward-facing, clip-free mount, replacing the single hardcoded
  // panelAnchor (kept as a fallback). System-internal (player can't feel the
  // ray budget) but lifted here per rule 2 for one-place tuning.
  SALVAGE_PANEL_SAMPLE_GRID_X: 3,        // candidate origins along the part length
  SALVAGE_PANEL_SAMPLE_GRID_Y: 3,        // candidate origins up the flank height
  SALVAGE_PANEL_FACE_INSET: 0.70,        // sample only the inner 70% of a face (skip curved-away edges)
  SALVAGE_PANEL_OUTWARD_MIN: 0.45,       // hit normal must point this much away from the part centroid
  SALVAGE_PANEL_MAX_NORMAL_Y: 0.4,       // reject sloped/top faces — panel can only yaw, not pitch
  SALVAGE_PANEL_FLATNESS_DEPTH_TOL: 0.13, // 4-ray probe ring must agree within this depth (m) = flush
  SALVAGE_PANEL_MIN_SEPARATION: 0.9,     // min gap (m) between two panels on the same part
  SALVAGE_PANEL_SURFACE_EPS: 0.012,      // push the mount this far proud to avoid z-fighting the hull skin
  // ACY — panel size variants. Each placed panel rolls one size for visual
  // variety (small access hatch → large cargo bay panel). Multiplies the
  // base SALVAGE_PANEL_SIZE_* via addAccessPanel's `scale`.
  SALVAGE_PANEL_SCALE_SMALL: 0.72,
  SALVAGE_PANEL_SCALE_LARGE: 1.32,
  SALVAGE_PANEL_SCALE_SMALL_THRESHOLD: 0.34,  // rand < this → small
  SALVAGE_PANEL_SCALE_LARGE_THRESHOLD: 0.78,  // rand >= this → large; between → standard
  SALVAGE_NOISE_MULTIPLIER_DURING_PRY: 1.3, // sandworm detection radius boost while prying
  // AAV — inventory size (slot counts). Hotbar is the 4 numbered slots
  // visible at the screen bottom; backpack is the larger overflow grid
  // shown in the inventory overlay (TAB-key). Pre-AAV was 4+10=14
  // total; AAV bumps backpack to 20 (5-col × 4-row grid) so the
  // player has room to carry diverse loot from the iterated salvage
  // system without constant inventory thrashing.
  HOTBAR_SLOT_COUNT: 4,
  BACKPACK_SLOT_COUNT: 20,
  // AAS — electrical-flicker glow on panel open. A small amber PointLight
  // ignites in the cavity when the door pries open, flickers via two
  // detuned sines, then fades over ~3s. Spec: peak intensity, fade
  // duration, flicker frequencies. Shadows OFF (50+ panels with shadow
  // lights would be expensive).
  SALVAGE_PANEL_GLOW_PEAK_INTENSITY: 0.55,
  SALVAGE_PANEL_GLOW_FADE_DURATION_S: 3.2,
  SALVAGE_PANEL_GLOW_RANGE_M: 1.2,           // PointLight range — tight to the cavity
  SALVAGE_PANEL_GLOW_COLOR_HEX: 0xff9a40,    // amber, matches fire palette
  // AAT — salvage condition tiers. Each panel gets one of 3 conditions
  // deterministically at boot (per id + biome + rand). Conditions affect
  // pry duration, extract count cap, loot tier, and visual appearance.
  // Distribution: base 35/50/15 (corroded/standard/pristine); salt-flat
  // wrecks +20% corroded (water + minerals); dune wrecks +10% pristine
  // (dry preservation).
  SALVAGE_CONDITION_PRY_MUL_CORRODED: 0.6,   // easier (rusty hinges give way)
  SALVAGE_CONDITION_PRY_MUL_STANDARD: 1.0,   // baseline
  SALVAGE_CONDITION_PRY_MUL_PRISTINE: 1.4,   // harder (sealed, fresh)
  SALVAGE_CONDITION_MAX_EXTRACTS_CORRODED: 2,  // few survivors of the rot
  SALVAGE_CONDITION_MAX_EXTRACTS_PRISTINE: 5,  // full panel + premium last component
  // Distribution roll thresholds (cumulative). Base ordering: pristine
  // first (15%), then standard (next 50%, cumulative 65%), then
  // corroded (remaining 35%). Biome biases shift the thresholds.
  SALVAGE_CONDITION_BASE_PRISTINE_THRESHOLD: 0.15,
  SALVAGE_CONDITION_BASE_STANDARD_THRESHOLD: 0.65,   // pristine ends, standard ends here
  SALVAGE_CONDITION_SALT_PRISTINE_THRESHOLD: 0.05,   // salt biome: less pristine
  SALVAGE_CONDITION_SALT_STANDARD_THRESHOLD: 0.45,   // salt biome: more corroded
  SALVAGE_CONDITION_DUNE_PRISTINE_THRESHOLD: 0.25,   // dune biome: more pristine
  SALVAGE_CONDITION_DUNE_STANDARD_THRESHOLD: 0.75,   // dune biome: less corroded
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

  // Title screen (animated main menu) — Session CC-3.
  // Wide-vista dune scene: camera atop a hero dune, tilted up to push the
  // horizon down (desert ~bottom-third / sky ~top-two-thirds). A tiny pod
  // streaks in like a shooting star and lands far away, where a big pyre
  // engulfs it. All animations run in a dedicated THREE.Scene.
  TITLE_DAY_CYCLE_SEC: 240,                 // full sun rotation period (slow, cinematic)
  // Camera atop the hero dune (sits at world (0,0); hero-bump adds height).
  TITLE_CAMERA_POS_X: 0,
  TITLE_CAMERA_POS_Y: 2.2,                  // EYE height above the dune surface (added to terrainY at camera xz)
  TITLE_CAMERA_POS_Z: 4,
  // Look target — X/Z are absolute world coords, Y is OFFSET above camera
  // (so the pitch stays constant if the dune height changes). Pitch is
  // arctan(LOOKAT_Y / horizontalDist) — tuned so horizon falls at the
  // bottom-third line (≈ +10–11° up).
  TITLE_CAMERA_LOOKAT_X: 30,
  TITLE_CAMERA_LOOKAT_Y: 20,
  TITLE_CAMERA_LOOKAT_Z: -100,
  TITLE_FOV: 62,
  TITLE_FAR: 700,
  TITLE_FOG_DENSITY: 0.0015,                // lighter haze — distant dunes read clearly
  // Dune terrain — large plane, displaced by layered sines + a Gaussian
  // hero bump centered on the origin (so the camera dune is tall).
  TITLE_GROUND_SIZE: 800,
  TITLE_GROUND_SEGMENTS: 120,
  TITLE_HERO_DUNE_HEIGHT: 8,
  TITLE_HERO_DUNE_WIDTH: 16,                // Gaussian sigma
  // Pod — vanishingly small, far-away shooting-star streak.
  TITLE_POD_SCALE: 0.04,
  TITLE_POD_START_X: 280,
  TITLE_POD_START_Y: 170,
  TITLE_POD_START_Z: -280,
  TITLE_POD_IMPACT_X: 90,
  TITLE_POD_IMPACT_Z: -180,
  TITLE_POD_TRAIL_LEN: 28,                  // # of segments in glow trail
  TITLE_FLY_IN_SEC: 9.0,                    // slow, deliberate descent
  TITLE_IMPACT_SEC: 0.3,
  TITLE_SETTLE_SEC: 1.6,
  // Pyre — replaces the campfire on the title scene. Tall column of flame
  // big enough to be visible from camera distance (~150m).
  TITLE_PYRE_HEIGHT: 6.0,
  TITLE_PYRE_BASE_RADIUS: 2.0,
  TITLE_PYRE_LIGHT_RANGE: 18,
  TITLE_DUST_COUNT: 80,
  TITLE_SMOKE_POOL: 24,
  TITLE_SHAKE_DECAY: 8.0,                   // higher = faster shake decay

  // Sand worm (Session DD-2; rescaled boss-tier Session MM, body 24→240m).
  // Roaming Dune-style ambush. Patrols a home zone underground; surfaces in
  // lunge arcs or vertical stationary breaches. Speeds DELIBERATELY unchanged
  // from the original 1× scale (D49 — combat must stay dodgeable; player
  // sprint is 13.2 m/s, charge stays at 8 m/s so a perpendicular sidestep
  // still works against the snapshotted-target charge).
  // AAL — moved sandworm home from (60, 0) to (900, 0) — was triggering
  // every test boot because player spawn at (-50, 0) was ~110m from the
  // old home with a 75m detection radius. New position is ~950m from
  // spawn, on the +X edge of the 2400m world (chunk band ends at 1200m).
  // Player has to deliberately walk out to encounter it. A future
  // session will overhaul the sandworm to be a procgen biome-seeded
  // spawn (currently fixed; falls outside the procgen pipeline). The
  // biome-check warn in main.ts will fire on seeds where +X edge isn't
  // dune — acceptable as a known footgun until the overhaul.
  // AAQ — themed POI clusters. Each world rolls N cluster anchors via
  // rejection sampling against flagships + spawn exclusion + each other.
  // Each cluster type is built from existing wreck/camp modules.
  CLUSTER_COUNT_PER_WORLD: 3,                // 1-2 military convoys + 1-2 caravans
  CLUSTER_SCATTER_RADIUS_MIN: 250,           // same band as flagships (200-800m)
  CLUSTER_SCATTER_RADIUS_MAX: 800,
  CLUSTER_MIN_SEPARATION: 320,               // cluster ↔ cluster (wider than flagships' 250)
  CLUSTER_SPAWN_EXCLUSION_RADIUS: 250,       // cluster ↔ player spawn (same as flagships)
  CLUSTER_FLAGSHIP_MIN_SEPARATION: 200,      // cluster ↔ flagship (slightly less — clusters smaller than flagships)
  CLUSTER_MAX_ROUGHNESS: 0.7,                // same gate as flagships — clusters need a level-ish patch
  // military_convoy — 3-5 wrecks aligned along a crash trajectory.
  MILITARY_CONVOY_LENGTH_MIN: 28,
  MILITARY_CONVOY_LENGTH_MAX: 48,
  MILITARY_CONVOY_WRECK_COUNT_MIN: 4,        // inclusive
  MILITARY_CONVOY_WRECK_COUNT_MAX: 6,        // inclusive
  // refugee_caravan — camp + 2-3 cargo + extra fuselage at tight radius.
  REFUGEE_CARAVAN_CARGO_COUNT_MIN: 2,
  REFUGEE_CARAVAN_CARGO_COUNT_MAX: 3,
  REFUGEE_CARAVAN_RADIUS_MIN: 6,             // cargo crates ring around the camp at this distance
  REFUGEE_CARAVAN_RADIUS_MAX: 12,

  SANDWORM_HOME_POS: { x: 900, z: 0 },       // AAP — legacy fallback only (was AAL test-fix world-edge anchor). Production uses sampleSandwormHome(rand, biomes, terrain) per AAP D-entry.
  // ACB debug flag — when true, sandworm spawns at a close position
  // (~80m from opening scene anchor) for fast iteration on the
  // encounter. Override of sampleSandwormHome. Set to false for ship.
  DEBUG_SANDWORM_NEAR_SPAWN: false,
  DEBUG_SANDWORM_NEAR_SPAWN_POS: { x: 20, z: 50 },
  // AAP — sandworm spawn-exclusion radius around the opening scene
  // anchor. Wider than flagship POIs (D82: 200m) because the player
  // should never see the worm in their first ~20s of unmounted
  // movement. Roughly: detection radius (150m) + ~200m walking buffer.
  SANDWORM_SPAWN_EXCLUSION_RADIUS: 350,
  // ACE Tier 2 — multi-worm population.
  /** How many sandworms spawn per world. Default 2; 1 reverts to the
   *  pre-ACE singleton encounter. Higher counts ramp the danger but
   *  risk overwhelming early-game (~5-10min before player has tools). */
  SANDWORM_COUNT: 2,
  /** Minimum separation (m) between any two worm home positions.
   *  Acts as exclusion radius in the per-worm rejection sampler. 400m
   *  ≈ 2.6× detection radius — far enough that two worms can't
   *  simultaneously engage the player unless they're charging from
   *  opposite directions. */
  SANDWORM_MIN_SEPARATION: 400,
  // AAP — noise multipliers on detection radius. Quiet stationary
  // player shrinks the worm's effective detection; sprinting / mounted
  // grows it. Falls back to 1.0 (raw radius) on any unhandled mode.
  SANDWORM_DETECTION_MULT_STILL: 0.55,        // standing/crouching: half-detect
  SANDWORM_DETECTION_MULT_WALKING: 1.0,       // baseline
  SANDWORM_DETECTION_MULT_SPRINTING: 1.45,    // loud footfalls
  SANDWORM_DETECTION_MULT_MOUNTED: 1.85,      // speeder hum is the loudest signal
  // QQ-2 — Sandworm rescaled −50% from MM (boss-tier 240m felt too
  // big in play). Length 240→120, radius 20→10. All RANGES that scale
  // with body size halved proportionally; speeds + durations + HP
  // unchanged per D49 (combat must stay dodgeable).
  SANDWORM_PATROL_RADIUS: 100,               // m — patrol circle radius (was 200)
  SANDWORM_DETECTION_RADIUS: 75,             // m — player triggers alert at this dist (was 150)
  SANDWORM_DISENGAGE_RADIUS: 100,            // m — player escapes by exceeding this (was 200)
  SANDWORM_PATROL_SPEED: 3,                  // m/s — slow patrol traversal (UNCHANGED per D49)
  SANDWORM_ALERT_SPEED: 5,                   // m/s — slow orienting movement (UNCHANGED)
  SANDWORM_CHARGE_SPEED: 8,                  // m/s — rush at player (UNCHANGED — dodgeable perpendicular)
  SANDWORM_RETREAT_SPEED: 7,                 // m/s — disengage movement (UNCHANGED)
  SANDWORM_ALERT_DURATION: 2.0,              // s — long windup so player can react (UNCHANGED — timing-based)
  SANDWORM_LUNGE_RANGE: 15,                  // m — trigger lunge when this close to player (was 30)
  SANDWORM_LUNGE_DURATION: 2.6,              // s — slower arc gives a real damage window (UNCHANGED)
  SANDWORM_BREACH_ARC_PEAK: 20,              // m — peak Y of lunge arc above ground (was 40)
  SANDWORM_STATIONARY_BREACH_DURATION: 5.5,  // s — vertical hold during stationary breach (UNCHANGED)
  SANDWORM_STATIONARY_BREACH_HEIGHT: 25,     // m — head rises above the dunes (was 50)
  SANDWORM_STATIONARY_BREACH_EVERY: 3,       // every Nth retreat → stationary breach
  // ACC — ambient twilight breach. During the dawn/dusk activity windows
  // (see twilightActivityMultiplier in sandWorm.ts: dayTime [0.18,0.22]
  // and [0.78,0.82]), a low-probability per-frame roll fires a stationary
  // breach at the worm's current patrol position — but ONLY if the
  // player is in the visibility band (far enough to be outside even the
  // mounted detection ring of ~139m, close enough to actually see the
  // 25m-tall silhouette before the descent). After the breach completes,
  // the worm returns straight to patrol (NOT the retreat→alert loop)
  // because there's no engagement to wind down — it was pure threat-
  // display. Long cooldown so the player sees this maybe once every
  // few in-game days.
  SANDWORM_TWILIGHT_BREACH_MIN_DIST: 180,       // m — player must be at least this far
  SANDWORM_TWILIGHT_BREACH_MAX_DIST: 400,       // m — and at most this far (visibility)
  SANDWORM_TWILIGHT_BREACH_PROB_PER_S: 0.012,   // per-second probability when both gates pass
  SANDWORM_TWILIGHT_BREACH_COOLDOWN_S: 480,     // 8 min cooldown after each breach
  SANDWORM_RETREAT_DISTANCE: 75,             // m — distance to retreat before next attack (was 150)
  SANDWORM_BITE_RANGE: 12.5,                 // m from worm body center for bite to land (was 25)
  SANDWORM_BITE_DAMAGE: 0.50,                // player health unit per bite (UNCHANGED — gameplay tuning)
  SANDWORM_MAX_HEALTH: 12.0,                 // 12 machete hits to kill (UNCHANGED — gameplay tuning)
  SANDWORM_LENGTH: 120,                      // m — total body length head-to-tail (was 240)
  SANDWORM_MAX_RADIUS: 10.0,                 // m — peak body radius (was 20)
  SANDWORM_UNDERGROUND_DEPTH: 12.5,          // m below ground while submerged (was 25)
  // ABJ — B12: feeding state. While in 'patrol', the worm scans for
  // meat pickups within FEED_DETECT_RADIUS and surfaces to feed (2x
  // damage vulnerability window for the player who baited it). Detect
  // radius is INDEPENDENT of player noise; the worm smells the meat
  // not the player. Duration matches stationaryBreach scale so the
  // bait-and-strike loop has the same dramatic window.
  SANDWORM_FEED_DETECT_RADIUS_M: 30,         // m — meat pickup detection radius (bait scent range)
  SANDWORM_FEED_DURATION_S: 4.5,             // s — total feeding state duration (rise + hold + descend)

  // ABJ — A4: dune buried cockpit POI. Count is the number of cockpit
  // POIs to spawn per world; 1 is the baseline (one per dune-biome
  // centroid). Future increases (e.g. 2-3 across larger maps) are
  // possible — the sampler does greedy multi-region placement.
  BURIED_COCKPIT_COUNT: 1,
  // ABK — A4 continuation: salt outpost + rocky entrance counts.
  // Same greedy multi-region pattern as the dune cockpit; counts
  // can be bumped per playtest signal if biomes feel under-populated.
  SALT_OUTPOST_COUNT: 1,
  ROCKY_ENTRANCE_COUNT: 1,

  // Opening wreck (Session RR — full redo using KK/LL/NN modelling
  // vocabulary). Cockpit + tail-stub composition built as N angular
  // slices of LatheGeometry — one slice on the top is intentionally
  // omitted to leave a genuine stress-fracture skylight running the
  // length of the upper hull. The lathe is rotated X = -π/2 so its
  // axial Y maps to world +Z; lathe Y=0 lands at the torn-open rear
  // (player enters), lathe Y=HULL_LEN lands at the cockpit nose.
  OPENING_WRECK_HULL_LEN: 6.0,               // m — total fuselage length (rear → nose)
  OPENING_WRECK_AXIS_Y: 1.0,                 // m — height of lathe axis above interior floor
  OPENING_WRECK_R_TAIL_RIM: 1.6,             // m — torn-stump rim radius (entrance). AAJ: was 1.4 — entrance felt cramped + visually hidden by fragments; widened so the player capsule (0.7m diameter) clearly fits the opening
  OPENING_WRECK_R_TAIL_BODY: 1.65,           // m — tail-stub body radius (AAJ: was 1.5 — matches the wider rim)
  OPENING_WRECK_R_NECK: 1.30,                // m — pinch between tail and cockpit
  OPENING_WRECK_R_COCKPIT: 1.7,              // m — cockpit max radius (widest point)
  OPENING_WRECK_R_NOSE: 0.55,                // m — pre-nose-tip radius (before final taper)
  OPENING_WRECK_SLICE_COUNT: 24,             // angular slices of the lathe (15° each)
  OPENING_WRECK_SKYLIGHT_SLICE: 11,          // AAM-followup #5: slightly off-center, narrower gap. Center at phi=195° = 15° off true UP toward the wreck-local -X side (= player's upper-left after yaw). User wanted "a bit to the side", not directly on top. Decorations (cockpit windows, antenna, panel-A) were moved to upper-right (lathe phi=135°) in the same followup to avoid floating-piece overlap with this gap.
  OPENING_WRECK_SKYLIGHT_WIDTH: 4,           // 4 slices = 60° gap, narrower than the previous 90° but still lets significant light in. Combined with the off-center bias, the wreck silhouette reads as asymmetric — decorations on one upper side, broken-open sky on the other.
  OPENING_WRECK_LATERAL_PUNCTURES: 3,        // number of small breach-hole patches scattered on side flanks
  OPENING_WRECK_FLOOR_THICK: 0.18,           // m — flat slab thickness below the cavity
  // AAM-followup — terrain-bridging ramp at the entrance. Pre-followup,
  // outside terrain dipping below maxFootprintY could create a step
  // > 0.3m autostep, blocking entry. The ramp = a thin tilted box
  // collider + matching visible rust-dark plate just outside the rim,
  // sloping from terrain level up to floor top.
  // AAM-followup #3: REVERTED the AAM-followup #2 bump back to 1.2/0.3 per
  // user feedback ("ramp was fine before"). The actual blocker was the
  // upper side wall colliders pinching the cavity at head height, not
  // the ramp. See followup #3's side-wall collider redesign.
  OPENING_WRECK_RAMP_LEN_M: 1.2,             // m — extent in -Z (outward from entrance)
  OPENING_WRECK_RAMP_DROP_M: 0.3,            // m — how much the outer edge drops below floor top
  OPENING_WRECK_RAMP_THICK_M: 0.12,          // m — plate thickness. AAM-followup #9: bumped 0.05 → 0.12 (matches CLAUDE.md rule 7) so the ramp doesn't read paper-thin from oblique angles.
  // AAJ — hull wall thickness. Pre-AAJ the hull was a single LatheGeometry
  // rendered DoubleSide; from inside the cavity that read as paper-thin
  // and unrealistic. AAJ adds an inner shell at R - HULL_WALL_THICKNESS
  // with BackSide interior material, plus an entrance rim torus closing
  // the cross-section gap. AAM-followup bumped 0.04 → 0.15 — 4cm was still
  // reading paper-thin from inside the cockpit; 15cm reads as proper
  // industrial spacecraft hull thickness.
  OPENING_WRECK_HULL_WALL_THICKNESS: 0.15,
  OPENING_WRECK_HULL_INTERIOR_HEX: 0x2a2218, // darker interior tone (the inside of a buried hull)
  OPENING_WRECK_PLAYER_SPAWN_OFFSET: 4.5,    // m — distance in front of the torn entrance where the player spawns (replaces hardcoded openingScene constant)

  // Sled (Session QQ) — placed flatbed sled with rope-tow + cargo
  // inventory. Mirrors tent/fire placement; uses a dynamic Rapier body
  // with a one-way spring-damper impulse pulling it toward a target pos
  // behind the tether (player on foot, or speeder when mounted). No
  // joints (none used elsewhere in the codebase).
  // ACC playtest — moderated to 300 (~160kg, like a heavy metal sled).
  // 2000 was overkill; 300 still resists KCC push noticeably (mass-
  // inverse 1/160 vs the original 1/42), while being a sane physical
  // weight that won't cause subtle integrator quirks. Slope physics
  // are mass-independent (we set velocity directly), so density does
  // not affect slide behavior.
  SLED_DENSITY: 300,
  SLED_LINEAR_DAMP: 1.8,                     // resists coasting — sled settles when player stops
  // ACC playtest — yaw torque gain. Replaces the old SLED_YAW_LERP
  // (which directly mutated group.rotation.y, conflicting with body
  // physics rotation). Now applied as a torque impulse around world Y
  // proportional to the cross product of (current sled forward) ×
  // (desired forward = toward anchor). Higher = sled snaps to face
  // anchor faster; lower = sled drifts more naturally behind.
  SLED_YAW_TORQUE_GAIN: 0.35,
  // ACC playtest — player-pulls-sled tuning. Realism: dragging a
  // loaded scrap-metal sled across sand should feel heavy. Sprinting
  // is fully disabled; walk speed is multiplied for slow-trudge feel.
  // Engages when ANY sled has `tether.kind === 'player'` (i.e. the
  // player is physically holding the rope on foot — speeder-tow uses
  // its own throttle).
  SLED_TOW_PLAYER_DISABLES_SPRINT: true,
  SLED_TOW_PLAYER_WALK_MULTIPLIER: 0.78,    // base "empty sled" multiplier (was 0.65 flat; cargo adds more drag below)
  // ACC playtest — cargo weight makes the sled harder to pull. Each
  // item in the sled's cargo deck adds this much additional slowdown,
  // clamped so even a fully-loaded sled is still walkable.
  SLED_TOW_PER_ITEM_SLOWDOWN: 0.02,         // 2% per item
  SLED_TOW_MIN_WALK_MULTIPLIER: 0.35,       // floor: never slower than 35% of normal walk speed
  // ACC playtest — pulling uphill is significantly harder than flat.
  // Multiplier scales with terrain slope at the SLED position
  // (cos(slope angle) = terrain normal Y). Only applies when the sled
  // is uphill of the player (player.y < sled.y); downhill or flat
  // tows have no extra resistance.
  SLED_TOW_UPHILL_RESISTANCE: 0.6,          // at vertical wall (slope=90°): full resistance × this (max 60% extra slowdown)
  // ACC playtest — downhill assist. When the sled is meaningfully
  // below the player (≥0.3m), gravity does some of the towing work
  // for you and your effective walk speed increases proportional to
  // slope. Caps at the base walk speed (towMult ≤ 1.0) so you can't
  // sprint via gravity alone.
  SLED_TOW_DOWNHILL_ASSIST: 0.4,
  // ACC playtest — sled-on-slope gravity slide. Each frame, sample
  // terrain normal at the sled's position; if the slope exceeds the
  // threshold, apply a horizontal impulse in the downhill direction
  // proportional to slope steepness. The sled accelerates naturally
  // down hills (whether tethered or staked or just placed). Linear
  // damping (SLED_LINEAR_DAMP) handles deceleration when the sled
  // reaches flat ground — it coasts briefly then stops smoothly.
  // ACC playtest — threshold dropped 0.04 → 0.02 (~2.3° → ~1.1°) so
  // even very gentle dune slopes start the sled drifting. The
  // acceleration is already proportional to slope, so this just gates
  // "truly flat" (no drift on rolling sand) from "shallow incline"
  // (slow but visible slide).
  SLED_SLOPE_SLIDE_THRESHOLD: 0.02,
  // ACU playtest tune — gain 6.0 → 2.5. At 6.0 even a barely-perceptible
  // incline (~1.4° critical, see KINETIC_FRICTION) sent the sled sliding fast,
  // which read as unrealistic. 2.5 (with KINETIC_FRICTION 0.20) raises the
  // critical "won't budge / decelerates to a stop" angle to ~4.6° and softens
  // terminal speeds: ~0.1 m/s @5° (still), ~1.3 m/s @10° (gentle drift),
  // ~3.6 m/s @20° (brisk, catchable), so slight slopes slow to a stop while
  // real dunes still slide. (The pre-ACU 6.0 was an over-eager ACC bump.)
  SLED_SLOPE_SLIDE_GAIN: 2.5,
  // ACC playtest follow-up — Coulomb-style ground friction coefficient
  // for slope-slide. Always opposes motion at a fixed deceleration of
  // `9.81 × this` m/s² (independent of speed), capped to not reverse the
  // velocity (Math.min(speed, frictionDeltaV) clamp). Combined with the
  // gravity slope component this produces a STATIC friction threshold:
  //   slide-accel > friction-decel  ⇔  sin(θ) × GAIN > KINETIC_FRICTION
  // ACU tune — 0.15 → 0.20 (with GAIN 2.5): critical angle ≈ asin(0.20/2.5)
  // ≈ 4.6°. Below that, gentle slopes don't move a stationary sled and
  // decelerate a moving one to a SMOOTH STOP (the Coulomb term is speed-
  // independent, so it actually halts rather than asymptotically coasting);
  // above it the sled accelerates to a damped terminal speed. Net terminals
  // (SLED_LINEAR_DAMP=1.8): ~0.1 m/s @5° (still), ~1.3 @10° (gentle drift),
  // ~3.6 @20° (brisk), ~6 @30° (fast). Bump toward 0.28 for an even stickier
  // threshold (~6.4°); drop toward 0.10 for longer coasts.
  SLED_KINETIC_FRICTION: 0.20,
  // ACC playtest follow-up — per-frame retention factor applied to the
  // managed slide-velocity scalars when the rope is slack on FLAT ground.
  // Compounded at 60Hz, 0.82/frame ≈ 99.99% removed per second — snaps
  // a stationary sled to rest almost immediately after the player stops
  // towing. Bump toward 0.95 for more coast (sled glides longer after
  // tow stop); drop toward 0.7 for snappier stops.
  SLED_SLACK_DECAY_PER_FRAME: 0.82,
  // ACC playtest follow-up — perpendicular-velocity damping applied when
  // the rope-snap position-clamp fires. Without this, a sled sliding
  // downhill on a slope whose downhill direction has any component
  // perpendicular to the rope would store that perpendicular speed in
  // _slideVx/Vz and "fly out to the side" each frame as the snap pulls
  // it back radially. 0.55 retains 55% of perpendicular velocity per
  // snap event — enough to let the sled track a curving slope, low
  // enough to kill any catastrophic sideways drift.
  SLED_SNAP_PERP_DAMP: 0.55,
  // ACC playtest follow-up — visual ground clearance above terrain.
  // Body Y is sampled from terrain.heightAt at the sled center, so on
  // uneven ground the body's bottom face can sit at the local minimum
  // while corners + the yoke posts extend across higher patches and
  // clip into the sand. This Y offset lifts the whole body uniformly
  // so a small terrain undulation across the 2.2m×1.2m footprint reads
  // as "resting on top" instead of "buried into". 6cm is enough for
  // typical dune micro-variation; bump higher if you see clipping on
  // sharper transitions.
  SLED_GROUND_CLEARANCE: 0.06,
  // ACC playtest — visual-only terrain tilt. Pitch/roll axes are LOCKED
  // on the body for physics stability (full unlocked rotations let item-
  // impact torques flip the sled, which then escapes terrain bounds).
  // The visual mesh tilts to match terrain normal at the sled position.
  // SLERP rate = how fast group.quaternion lerps toward the target tilt
  // each frame. Higher = snappier follow, lower = smoother on bumps.
  SLED_VISUAL_TILT_LERP: 0.18,
  // ACC playtest — bumped from 0.5×0.9 to 0.6×1.10 (+20% width, +22%
  // length) per user feedback "items keep falling off the back". More
  // landing area for thrown items + more room before the back rim
  // catches them.
  SLED_HALF_EXTENTS_X: 0.6,                  // cargo bed half-width (1.2m wide)
  // ACU #42 — sled-vs-POI collision. When true, the sled shapecasts its
  // footprint before each move and clamps short of any FIXED, non-terrain
  // collider (POI/wreck/rock), so it can no longer be dragged or slid through
  // solid structures. Flag so it's instantly reversible if it regresses the
  // (heavily-iterated) slide/tow feel. Cast half-height taller than the flat
  // 2cm body so it reliably intersects POI hull walls.
  SLED_POI_COLLISION: true,
  SLED_POI_COLLISION_CAST_HALF_Y: 0.40,
  SLED_POI_COLLISION_SKIN_M: 0.05,           // back-off gap so the sled rests just shy of the wall
  // ACD playtest follow-up — lowered 0.10 → 0.02. The body cuboid was
  // 20cm tall, putting items resting on the top deck collider ~29cm
  // above terrain (well above the visual scrap-sheet's flat center
  // base, ~6cm above terrain). Items visibly floated above the deck.
  // Shrinking body height to 4cm drops items to ~13cm above terrain
  // (7cm above visual deck base), inside the visual U-bowl rather than
  // floating above its rim. Visual lateral + back curl heights are
  // now DECOUPLED from hy via SLED_VISUAL_*_CURL constants below so
  // the visible rim shape doesn't shrink with the collider.
  SLED_HALF_EXTENTS_Y: 0.02,                 // flat
  SLED_HALF_EXTENTS_Z: 1.10,                 // longer than wide — runner-shaped (2.2m long)
  // ACD playtest follow-up — visual rim shape decoupled from hy. Pre-fix
  // these were `hy * 2.6` and `hy * 1.9` inline in makeSledVisual, so
  // shrinking the body's hy would also shrink the visual U-bowl rim.
  // Explicit constants preserve the rim height regardless of collider
  // size. Tweak independently of the physics geometry.
  SLED_VISUAL_LATERAL_CURL: 0.26,            // m — lateral curl peak height above the visual deck base
  SLED_VISUAL_BACK_CURL: 0.19,               // m — back curl peak height above the visual deck base
  SLED_TOW_DISTANCE: 5.0,                    // rope length (m). The sled is constrained to within this distance of the anchor — slack inside, snaps taut at exactly this length. QQ-2 lengthened 3 → 5 for visible drape.
  SLED_TOW_MAX_DIST: 10.0,                   // hard snap threshold beyond which the rope tears free (anchor moved way too fast for the constraint to keep up). Auto-detach + toast.
  SLED_TOW_ATTACH_RANGE: 3.0,                // raycast distance for clicking the rope stub with wielded rope
  // ACF — B1 Phase 3 follow-up: corpse/carcass drag. The kill is the TOWED
  // body (anchored to the player on foot, or the speeder for the worm) and
  // rides the shared inextensible-rope constraint. Tuned looser than the
  // sled (a body drags heavier / further behind than a yoked sled).
  KILL_DRAG_RAIDER_MAX_DIST: 3.2,            // rope length (m) for a dragged raider corpse — short leash so the body trails close behind.
  KILL_DRAG_RAIDER_TEAR_DIST: 7.0,           // beyond this the rope slips off the corpse (auto-detach + toast).
  KILL_DRAG_RAIDER_HY: 0.25,                 // body Y half-extent used to clamp the corpse above terrain after a snap.
  KILL_DRAG_WORM_MAX_DIST: 14.0,             // rope length (m) for a worm carcass towed behind the speeder — long, the carcass is enormous.
  KILL_DRAG_WORM_TEAR_DIST: 26.0,            // speeder can yank hard; tear only on extreme overstretch.
  KILL_DRAG_WORM_HY: 1.5,                    // worm body Y half-extent for terrain clamp.
  KILL_DRAG_SNAP_PERP_DAMP: 0.6,             // perpendicular-swing damping at snap (shared by both kinds). Higher = the dragged body settles behind the anchor faster.
  KILL_DRAG_GROUND_CLEARANCE: 0.05,          // visual lift above terrain so the dragged body doesn't sink into sand on a slope.
  SLED_ROPE_COLOR_HEX: 0x6e4a2a,             // matches branch/wood palette
  SLED_ROPE_RADIUS: 0.04,                    // QQ-2 tube radius — thicker than the previous 2-vertex Line
  SLED_ROPE_SAG: 0.45,                       // QQ-2 max midpoint drop (m) when the rope is taut; scales with slack to 0 at fully-stretched
  // ACC P1 — top deck collider. A 2nd cuboid attached to the sled body
  // sits just above the main collider's top face. Items dropped on the
  // sled land here (it's the highest surface). High friction so items
  // grip during tow + sharp turns. The main collider keeps its existing
  // 0.6 friction for the sled-on-sand tow feel. The top collider is
  // slightly inset on X/Z so the visual curled rim of the scrap-metal
  // sheet appears to "hold items in the bed".
  SLED_TOP_DECK_HALF_THICKNESS: 0.015,       // m — 3cm thick top shelf
  SLED_TOP_DECK_FRICTION: 0.95,              // high so items grip when sled accelerates
  SLED_TOP_DECK_INSET_X_FRAC: 0.88,          // top collider X = SLED_HALF_EXTENTS_X × this (inside the curled rim)
  SLED_TOP_DECK_INSET_Z_FRAC: 0.95,          // top collider Z = SLED_HALF_EXTENTS_Z × this (avoid the yoke region)
  // ACC playtest — physical back-wall lip. Items on a towed sled slide
  // REARWARD relative to the deck (inertia vs the inextensible-rope
  // position-snap pulling the sled forward). Without a back wall they
  // fall off. Visual back-rim curl alone isn't sufficient since items
  // physically rest on the flat top deck collider, not the curved
  // visual sheet. Thin tall lip just inside the rear edge.
  SLED_BACK_WALL_HALF_HEIGHT: 0.04,          // m — 8cm wall height (catches small items, doesn't dominate look)
  SLED_BACK_WALL_HALF_THICKNESS: 0.015,      // m — 3cm thick (matches top-deck thickness)
  // ACC Stretch — drop / throw arc. Drop velocity is camera-direction
  // based (Y component preserved) so the player can AIM their throw:
  // look down → item lands at feet; look at the sled → item arcs onto
  // the deck. Pre-ACC drops zeroed cam-Y and used a tiny 1.5 m/s push
  // — now we lift the speed so the toss is functional for sled-loading.
  ITEM_TOSS_SPEED: 3.2,                      // m/s along camera direction
  ITEM_TOSS_BASE_UP: 1.0,                    // m/s baseline upward kick (keeps tossed items off the ground at low pitches)
  // ACC playtest — lowered 0.12 → 0.07 so the sled's bow takes longer
  // to swing around when the player turns. Reads as a heavier, more
  // realistic turning arc (real sleds drift wide when the puller
  // changes direction). Combined with the rope-taut-only gate (lerp
  // only fires when dist > 0.8 × TOW_DISTANCE), the sled has a
  // natural "swing behind" feel.
  SLED_YAW_LERP: 0.07,
  NEAR_SLED_DISTANCE_SQ: 4.0,                // 2m exclusion when placing a new sled near an existing one
  STAMINA_TOW_FACTOR: 1.5,                   // sprint+tow on foot drains stamina × this. ABJ: 2.0→1.5 (sprint duration when towing 3s→4s; reads less punishing for short tow runs while still discouraging long sled hauls at sprint)

  // ────────────────────────────────────────────────────────────────
  // ABJ — D1: scavenger-camp magic-number lift from poi.ts.
  // Spatial / size constants for placeScavengerCamp. Lifted to
  // Tuning so future scavenger-camp redesigns can iterate without
  // hunting through poi.ts.
  // ────────────────────────────────────────────────────────────────
  // ABO C1 — fire-ring + bandage-pickup constants struck. Pre-ABO these drove
  // the 8-stone fire ring + ash patch + bandage placement; all removed in ABN
  // triage (scavenger camp now just the fuselage windbreak). FUSELAGE_* kept.
  SCAVENGER_CAMP_FUSELAGE_OFFSET_X_M: -1.4,  // fuselage windbreak placement offset from center
  SCAVENGER_CAMP_FUSELAGE_OFFSET_Y_M: -0.35, // partly buried
  SCAVENGER_CAMP_FUSELAGE_YAW_RAD: 0.4,      // rotated for "crash-tilt" reading

  // ────────────────────────────────────────────────────────────────
  // ACL parallel-lane integration — promoted lane locals.
  // ────────────────────────────────────────────────────────────────

  // ACL AIM TWIST-IK — 3P upper-body aim twist on the lead shoulder.
  // ACN — made DYNAMIC: leads INTO turns by turn-rate, relaxing to the resting bias.
  AIM_TWIST_BIAS: 0.18,    // resting aim-twist yaw (rad) the right shoulder holds when not turning (ACN: 0.35→0.18, the static value read too square)
  AIM_TWIST_CLAMP: 0.5,    // hard clamp on aim twist magnitude (±rad)
  AIM_TWIST_LERP: 0.12,    // per-frame lerp factor toward target (smoothing)
  AIM_TWIST_TURN_GAIN: 0.18, // (rad of lead) per (rad/sec of camera turn rate); lead winds INTO the turn (ACN). ACV #41: 0.10→0.18 — the ACN harness undersampled the continuous-turn peak; the upper-body lead read too subtle in real 3P turns. Foreground-feel item (D150).

  // ACL SPEEDER ANGULAR DAMPING — passive Y-yaw settle on the MOUNTED body.
  // Distinct from SPEEDER_UNMOUNTED_ANGULAR_DAMP_RATE_PER_S (2.5). At 1.2/s a
  // 1 rad/s spin drops to ~0.3 rad/s after 1s; steady steering ~unaffected.
  SPEEDER_MOUNTED_ANGULAR_DAMP_RATE_PER_S: 1.2,

  // ACL WORM TWILIGHT-BREACH AUDIO — distance attenuation for the breach roar.
  WORM_ROAR_NEAR_DIST: 180,   // m — full volume at/under this player distance
  WORM_ROAR_FAR_DIST: 400,    // m — attenuated to WORM_ROAR_FAR_VOL at this distance
  WORM_ROAR_FAR_VOL: 0.2,     // target roar volume scalar (0..1) at FAR_DIST
  WORM_ROAR_CUTOFF_DIST: 650, // m — effectively silent beyond this

  // ACL megawreck-catwalk-panel-reachability — ground-reachable hull-panel height.
  WRECK_GROUND_PANEL_Y: 1.5,  // chest/eye height (m) for ground-level exterior salvage panels

  // ACL SKY+WEATHER — twinkling/drifting star field (custom ShaderMaterial).
  STAR_TWINKLE_SPEED: 1.6,       // radians/sec base rate of the per-star twinkle sine
  STAR_TWINKLE_DEPTH: 0.45,      // 0..1 — opacity dip at the twinkle trough
  STAR_TWINKLE_SIZE_DEPTH: 0.30, // 0..1 — point size pulse with the twinkle
  STAR_DRIFT_RATE: 0.0042,       // radians/sec — slow celestial rotation of the field (X tilt = 0.18x)
  STAR_BASE_SIZE: 1.6,           // base px point size (replaces old PointsMaterial.size)
  STAR_STORM_STATE_FLOOR: 0.55,  // extra star suppression during building/storm/settling (cloud occlusion)
  // ACAB (Cycle 6) — procedural cloud layer (sky.ts SKY_FRAGMENT).
  CLOUD_COLOR_HEX: 0xd6d8e2,     // lit cloud tops
  CLOUD_DARK_HEX: 0x6a6e7e,      // shaded cloud undersides
  CLOUD_SCALE: 1.3,              // cloud feature frequency on the projection plane (higher = smaller, more puffs)
  CLOUD_DRIFT_X: 0.06,           // cloud-plane drift per second (wind)
  CLOUD_DRIFT_Z: 0.03,
  CLOUD_MAX_ALPHA: 0.92,         // peak cloud opacity over the sky
  // Cloud-cover weather (clear↔overcast days, independent of the storm cycle).
  CLOUD_COVER_NOISE_PERIOD_S: 240, // seconds for the slow clear↔cloudy oscillation
  CLOUD_COVER_LERP_RATE: 0.15,     // how fast cloudiness chases its target (per sec)
  CLOUD_STORM_FLOOR: 0.85,         // cloudiness forced this high while a storm builds/rages
  CLOUD_SUN_DIM: 0.55,             // overcast cuts direct sun by up to this fraction
  CLOUD_AMBIENT_LIFT: 0.5,         // overcast lifts daytime ambient by up to this fraction
  // ACL SKY+WEATHER — directional Dune-style sweeping sandstorm wall.
  STORM_WALL_WIDTH: 140,           // half-thickness (world u) of the full-intensity core
  STORM_WALL_SPEED: 26,            // wall travel speed (world u/sec)
  STORM_WALL_SPAWN_DIST: 520,      // distance upwind the wall spawns ahead of the player at storm start
  STORM_WALL_APPROACH_FALLOFF: 380,// ramp distance (u) over which intensity rises as the wall nears
  STORM_WALL_DEPART_FALLOFF: 300,  // ramp distance (u) over which intensity falls as the wall departs
  STORM_WALL_RETIRE_DIST: 260,     // signed distance past the player at which the wall is spent (ends storm early)
  STORM_WALL_WIND_BIAS: 5.5,       // extra wind (u/s) along wall dir at full intensity for mid dust layer (far x1.4, near x0.6)
  // ACW E (#146/#134) — storm wind pushes loose bodies + in-storm sensory.
  STORM_WIND_PUSH_ACCEL: 4.5,      // u/s² wind accel on loose bodies (dropped pickups, parked speeder, slack sled) at full world intensity
  STORM_CAM_SWAY_AMP: 0.022,       // rad — peak camera sway (pitch/roll) buffeting at full perceivedIntensity
  STORM_CAM_SWAY_FREQ: 1.7,        // Hz base — gust sway frequency (pitch + roll run at slightly different rates)
  STORM_AUDIO_LP_MIN_HZ: 2600,     // master low-pass cutoff at full storm (muffled); opens to ~20kHz when clear

  // ACL IN-STORM MOVEMENT PENALTY — unsheltered slow-down in a storm.
  STORM_PENALTY_INTENSITY_THRESHOLD: 0.55, // intensity below which there is no movement penalty
  STORM_PENALTY_MAX_WALK_SLOWDOWN: 0.3,    // fraction of walk speed shaved at full intensity (sprint disabled while active)

  // ACL ITEMS — amban_rifle ranged weapon spec.
  WEAPON_AMBAN_RIFLE_RANGE: 60.0,    // m — raycast reach, ~2x scrap gun
  WEAPON_AMBAN_RIFLE_DAMAGE: 3.0,    // flat per-shot damage (2x scrap gun)
  WEAPON_AMBAN_RIFLE_COOLDOWN: 1.6,  // seconds between shots (heavier than scrap gun)
  WEAPON_AMBAN_RIFLE_MAX_AMMO: 8,    // magazine capacity

  // ACAC — pulse rifle: rapid-fire energy weapon with a self-recharging cell
  // (no ammo item). Low per-pulse damage but a fast cadence (auto-fire while
  // LMB held). The cell drains 1 per pulse + recharges over time when idle;
  // sustained fire empties it, forcing a brief cool-down before it refills.
  WEAPON_PULSE_RIFLE_RANGE: 48.0,      // m — raycast reach (between scrap gun + amban)
  WEAPON_PULSE_RIFLE_DAMAGE: 1.3,      // flat per-pulse damage (low — DPS comes from cadence)
  WEAPON_PULSE_RIFLE_COOLDOWN: 0.13,   // seconds between pulses (rapid auto-fire)
  WEAPON_PULSE_RIFLE_CELL_MAX: 28,     // energy cell capacity (pulses)
  WEAPON_PULSE_RIFLE_RECHARGE_PER_S: 7, // cell pulses regenerated per second while not firing
  WEAPON_PULSE_RIFLE_RECHARGE_DELAY_S: 0.6, // seconds after the last shot before the cell recharges
  VIEWMODEL_PULSE_RIFLE_ANIM_S: 0.12,  // quick per-pulse recoil flick

  // ACL DESERT SHREW — skittery prey creature (mirrors lizard pipeline).
  SHREW_SPOT_DISTANCE: 7,          // m — player proximity that triggers flee
  SHREW_FLEE_SPEED: 3.2,           // m/s — fast skittery bolt
  SHREW_FLEE_DURATION: 2.4,        // s — flee burst length
  SHREW_WANDER_SPEED: 0.7,         // m/s — slow idle amble between wander targets
  SHREW_WANDER_RADIUS: 4.0,        // m — max distance of a wander target from current pos
  SHREW_IDLE_MIN: 1.5,             // s — min rest before picking a new wander
  SHREW_IDLE_MAX: 5.0,             // s — max rest before picking a new wander
  SHREW_ARRIVE_EPS: 0.25,          // m — wander 'arrived' threshold
  SHREW_TERRAIN_OFFSET: 0.04,      // m — mesh lift above terrain
  SHREW_TARGET_COUNT: 14,          // total shrews scattered across the world
  SHREW_SPAWN_BUFFER_FROM_ORIGIN: 25, // m — keep them out of the opening scene
  SHREW_CLUSTER_RADIUS_MIN: 4,     // m — min distance from a POI for a cluster spawn
  SHREW_CLUSTER_RADIUS_MAX: 14,    // m — max distance from a POI for a cluster spawn
  SHREW_SCATTER_RADIUS_MAX: 220,   // m — global-pass scatter radius
  SHREW_PER_POI_AVG: 1.4,          // avg shrews clustered per POI
  // ACW B5 — shrew walk gait + burrow-on-approach.
  SHREW_GAIT_FREQ_HZ: 4.0,         // Hz — stubby-leg cadence (faster than the lizard)
  SHREW_GAIT_SWING: 0.5,           // rad — fore/aft leg swing
  SHREW_GAIT_LIFT: 0.008,          // m — foot lift at mid-swing (small legs)
  SHREW_BURROW_RADIUS: 2.6,        // m — player proximity that triggers a dive into the sand
  SHREW_BURROW_DEPTH: 0.34,        // m — how far below the surface the shrew sinks
  SHREW_BURROW_TRANSIT_S: 0.55,    // s — descent / re-emerge duration
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
