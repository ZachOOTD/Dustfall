// UNDERWORLD cycle 2 — the CAVE as a PLACE OF DARKNESS (light model + fog).
//
// Cycle 1/2 gave the generated cave its GEOMETRY (caveTest bore + caveGen room-graph). This
// module makes the labyrinth actually DARK and gives it the survival-loop light model:
//
//  1. TRUE DARKNESS. Once the player is CONTAINED in the cave (inside the cave XZ bounding box AND
//     below the terrain sheet), ambient + sun + moon fade to a near-black FLOOR over a few metres
//     of depth past the throat. So the deep tree is genuinely black — "no light, no cave": the
//     player's own torch / flashlight / placeable lantern (all scene-direct world lights that work
//     underground unchanged) are the only real illumination. There is NO free auto-torch (unlike
//     the old funnel deepCave) — the darkness IS the survival pressure.
//  2. THE MOUTH SHAFT. A warm daylight SpotLight spills down the open trench onto the ramp, its
//     intensity tracking the surface sun (bright at noon, faint at night), fading with depth so it
//     never reaches the deep chambers. The one soft link back to the surface.
//  3. FOG. The desert's sandy FogExp2 haze reads wrong underground, so inside the cave the fog
//     colour shifts to near-black and its density rises (a depth cue — the far end of a hall fades
//     to black) — restored exactly at the mouth (darkness=0 → base density/colour).
//
// CHEAP + GLOBAL (the deepCave pattern): dimming the scene-wide lights/fog is fine because the
// player only SEES the cave once enclosed (the rock occludes the surface), and the containment
// factor is 0 everywhere else so the surface world is untouched. Runs AFTER updateLighting (which
// sets the surface values each frame) — this scales them down. Behind FEATURES.caveTest: this whole
// module is dormant (never created) with the flag OFF → surface world byte-identical.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import type { CaveGraph } from './caveGen.ts';
import type { CaveTestProbe } from './caveTest.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerPos } from '../util/playerPos.ts';

export interface CaveAtmosphere {
  /** Cave XZ bounding box (node footprints + the bore trench), pre-expanded by the AABB margin. */
  minX: number; maxX: number; minZ: number; maxZ: number;
  /** The warm daylight shaft down the mouth ramp (day-driven; off when the player is far). */
  shaft: THREE.SpotLight;
  /** Base FogExp2 density captured at creation — restored when the player leaves the cave. */
  baseFogDensity: number;
  /** Smoothed 0..1 containment factor (eased toward the live darkness each frame) — the audio bed
   *  reads this (`ctx.caveAtmosphere.inside`) to duck the desert + fade the cave bed in. */
  inside: number;
  /** Live (un-smoothed) darkness factor this frame — for the probe. */
  darkness: number;
  _fogColor: THREE.Color;
}

/** Pure containment/darkness factor at a world point: 0 outside the cave AABB or at the surface,
 *  ramping to 1 a few metres below the terrain sheet inside the box. Shared by the light model and
 *  the audio bed so both agree. */
export function caveDarknessAt(atmo: CaveAtmosphere, x: number, y: number, z: number, terrain: GameContext['terrain']): number {
  const m = Tuning.CAVE_DARK_AABB_MARGIN;
  if (x < atmo.minX - m || x > atmo.maxX + m || z < atmo.minZ - m || z > atmo.maxZ + m) return 0;
  const surf = terrain.pureHeightAt(x, z);
  const depth = surf - y;                        // how far below the surface sheet the player is
  if (depth <= 0) return 0;                       // on/above the surface → not dark
  const t = Math.min(1, depth / Tuning.CAVE_DARK_DEPTH_FADE);
  return t * t * (3 - 2 * t);                     // smoothstep 0→1 over the fade depth
}

/** Build the cave atmosphere: compute the XZ bounding box from the graph + bore trench, and place
 *  the warm daylight shaft above the open trench aimed down the ramp. */
export function createCaveAtmosphere(scene: THREE.Scene, bore: CaveTestProbe, graph: CaveGraph): CaveAtmosphere {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of graph.nodes) {
    const r = Math.max(n.rx, n.rz) + Tuning.CAVE_GEN_DISP_AMP;
    minX = Math.min(minX, n.x - r); maxX = Math.max(maxX, n.x + r);
    minZ = Math.min(minZ, n.z - r); maxZ = Math.max(maxZ, n.z + r);
  }
  // Include the bore trench (mouth → throat), which lives on the -heading side of node 0.
  const hw = bore.width * 0.5 + 1.0;
  minX = Math.min(minX, bore.mouthX - 2); maxX = Math.max(maxX, bore.chamberFarX + 2);
  minZ = Math.min(minZ, bore.centerZ - hw); maxZ = Math.max(maxZ, bore.centerZ + hw);

  // The open sky trench centre (between the mouth lip and the roofed throat) — the shaft comes down
  // HERE. Positioned high above it and aimed down-ramp into the throat, so warm daylight pools on
  // the ramp floor + trench walls near the opening and fades before the deep tree.
  const trenchMidX = (bore.mouthX + bore.trenchFarX) * 0.5;
  const shaft = new THREE.SpotLight(
    Tuning.CAVE_SHAFT_COLOR_HEX, 0, Tuning.CAVE_SHAFT_DIST,
    Tuning.CAVE_SHAFT_ANGLE_RAD, Tuning.CAVE_SHAFT_PENUMBRA, 1.4);
  shaft.castShadow = false;
  shaft.position.set(trenchMidX, bore.gy + 5, bore.centerZ);
  shaft.target.position.set(bore.trenchFarX + 3, bore.chamberFloorY, bore.centerZ);
  shaft.visible = false;
  scene.add(shaft, shaft.target);

  const fog = scene.fog as THREE.FogExp2 | null;
  return {
    minX, maxX, minZ, maxZ, shaft,
    baseFogDensity: fog ? fog.density : Tuning.FOG_DENSITY_CLEAR,
    inside: 0, darkness: 0, _fogColor: new THREE.Color(),
  };
}

/** Per-frame: darken the scene when the player is contained in the cave (scale the surface lights
 *  updateLighting just set), shift the fog to near-black, and drive the mouth shaft by sun height.
 *  Call AFTER updateLighting + updatePlayer (the deepCave slot). Pause-safe (tick pause-gate skips). */
export function updateCaveAtmosphere(ctx: GameContext, atmo: CaveAtmosphere, dt: number): void {
  const p = getPlayerPos(ctx);                    // D297 — speeder-aware effective player pos
  const d = caveDarknessAt(atmo, p.x, p.y, p.z, ctx.terrain);
  atmo.darkness = d;
  // Smooth the audio-facing factor toward the live darkness (mouth crossfade — no pop).
  atmo.inside += (d - atmo.inside) * Math.min(1, Tuning.CAVE_BED_LERP_RATE * dt);

  if (d > 0) {
    ctx.lights.ambient.intensity *= (1 - d) + d * Tuning.CAVE_DARK_AMBIENT_FLOOR;
    ctx.lights.sun.intensity *= (1 - d) + d * Tuning.CAVE_DARK_SUN_FLOOR;
    ctx.lights.moon.intensity *= (1 - d) + d * Tuning.CAVE_DARK_SUN_FLOOR;
  }

  // Fog: shift colour toward near-black + raise density with darkness. Lerp FROM this frame's live
  // fog (updateWeather already set the surface colour + density earlier in the tick), so at d=0 the
  // fog is left completely untouched — the surface storm fog is never clobbered.
  const fog = ctx.three.scene.fog as THREE.FogExp2 | null;
  if (fog && d > 0) {
    fog.density += (Tuning.CAVE_FOG_DENSITY - fog.density) * d;
    fog.color.lerp(atmo._fogColor.setHex(Tuning.CAVE_FOG_HEX), d);
  }

  // The mouth shaft — warm daylight down the ramp, bright at noon → faint at night. Only enabled
  // when the player is near the cave (within the AABB + margin), so it never touches the far surface.
  const m = Tuning.CAVE_DARK_AABB_MARGIN + 6;
  const near = p.x > atmo.minX - m && p.x < atmo.maxX + m && p.z > atmo.minZ - m && p.z < atmo.maxZ + m;
  const sunUp = Math.max(0, ctx.time.sunHeight);
  const shaftInt = near ? Tuning.CAVE_SHAFT_INTENSITY * (0.12 + 0.88 * sunUp) : 0;
  atmo.shaft.visible = shaftInt > 0.01;
  atmo.shaft.intensity = shaftInt;
}
