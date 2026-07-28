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
import type { CaveEntranceProbe } from './caveEntrance.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerPos } from '../util/playerPos.ts';
import { updateCavePoolWater } from './cavePools.ts';   // DEEPER cycle 6 — the pool ripple clock
import { setCaveRockLightState } from './caveGen.ts';  // DEEPER cycle 7 — the rock light-response uniforms

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
  /** DEEPER cycle 10 — WHICH cave the darkness is coming from ('origin', a resident key, or null).
   *  Diagnostic only; the probe prints it so "the interior is lit" can name the cave it is in. */
  inCaveKey: string | null;
  _fogColor: THREE.Color;
  _ambColor: THREE.Color;
}

/** Pure containment/darkness factor at a world point: 0 outside every cave footprint or at the
 *  surface, ramping to 1 a few metres below the terrain sheet inside one. Shared by the light model
 *  and the audio bed so both agree.
 *
 *  DEEPER cycle 10 — PLURAL CAVES. This module was written for the ONE origin cave (Underworld) and
 *  tested only its AABB, so in the cycle-8/9 streamed world every OTHER cave scored 0: no ambient
 *  dimming, no cave fog (the sandy desert haze underground), no rock light-response, no audio duck,
 *  and — because sky.ts reads this same factor — the sun disc drawn straight through the ceiling.
 *  Measured in a streamed `warren`: amb 0.837 at noon vs 0.28 at midnight, deep-chamber meanL 17.2
 *  vs 3.5, sun disc L=181 painted on solid rock. The fix is to ask the STREAMER which cave contains
 *  the player — `caveStream.occupied()`, the same authoritative signal eviction protection uses —
 *  and to keep the origin AABB as a first test so the origin cave's behaviour is bit-for-bit what
 *  it always was (its box, unlike a streamed resident's, already includes the open bore trench).
 *
 *  The occupancy margin (45m) is wider than this module's own (14m) and that is harmless: `depth`
 *  gates everything, and the terrain is a heightfield — the ONLY way to be below `pureHeightAt` is
 *  to be inside a carved cave hole. The wide pad simply means the crevice descent (a ~24m run at
 *  CREVICE_DEPTH/CREVICE_SLOPE_DEG) is covered end to end, which is exactly where the ramp belongs. */
export function caveDarknessAt(
  atmo: CaveAtmosphere, p: { x: number; y: number; z: number }, ctx: GameContext,
): number {
  const m = Tuning.CAVE_DARK_AABB_MARGIN;
  const { x, y, z } = p;
  let key: string | null = null;
  if (!(x < atmo.minX - m || x > atmo.maxX + m || z < atmo.minZ - m || z > atmo.maxZ + m)) {
    key = 'origin';
  } else if (ctx.caveStream) {
    const r = ctx.caveStream.occupied(p);        // allocation-free; reads x/z only
    if (r) key = r.key;
  }
  atmo.inCaveKey = null;
  if (!key) return 0;
  const surf = ctx.terrain.pureHeightAt(x, z);
  const depth = surf - y;                        // how far below the surface sheet the player is
  if (depth <= 0) return 0;                       // on/above the surface → not dark
  atmo.inCaveKey = key;
  const t = Math.min(1, depth / Tuning.CAVE_DARK_DEPTH_FADE);
  return t * t * (3 - 2 * t);                     // smoothstep 0→1 over the fade depth
}

/** Build the cave atmosphere: compute the XZ bounding box from the graph + bore trench, and place
 *  the warm daylight shaft above the open trench aimed down the ramp. */
export function createCaveAtmosphere(scene: THREE.Scene, bore: CaveEntranceProbe, graph: CaveGraph): CaveAtmosphere {
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
    inside: 0, darkness: 0, inCaveKey: null,
    _fogColor: new THREE.Color(), _ambColor: new THREE.Color(),
  };
}

/** Per-frame: darken the scene when the player is contained in the cave (scale the surface lights
 *  updateLighting just set), shift the fog to near-black, and drive the mouth shaft by sun height.
 *  Call AFTER updateLighting + updatePlayer (the deepCave slot). Pause-safe (tick pause-gate skips). */
export function updateCaveAtmosphere(ctx: GameContext, atmo: CaveAtmosphere, dt: number): void {
  const p = getPlayerPos(ctx);                    // D297 — speeder-aware effective player pos
  // DEEPER cycle 6 — the pool ripple clock. ONE uniform write for every pool in the world (the shared
  // water material), on the cave's own pause-gated tick, so the surface animates only where it exists.
  updateCavePoolWater(ctx.time.elapsed);
  const d = caveDarknessAt(atmo, p, ctx);
  atmo.darkness = d;
  // Smooth the audio-facing factor toward the live darkness (mouth crossfade — no pop).
  atmo.inside += (d - atmo.inside) * Math.min(1, Tuning.CAVE_BED_LERP_RATE * dt);

  // ── DEEPER cycle 10 — THE DEEP INTERIOR IS A CONSTANT, NOT A FRACTION OF THE SKY ──────────────
  //   Zach, walk-test: *"the caves are brighter during the day and darker at night so the light
  //   looks like it is penetrating the terrain"*. He was reading a real coupling. Every deep target
  //   here used to be a MULTIPLIER of the value updateLighting had just written, and that value
  //   swings 0.73 → 0.28 across a day — so the deep chamber's ambient breathed 0.0223 → 0.0084
  //   with the sun, through tens of metres of rock, plus a colour shift with the weather on top.
  //
  //   So the targets are now ABSOLUTE LEVELS and the blend is a lerp: at d=1 the interior is
  //   exactly CAVE_DARK_AMBIENT_LEVEL / _HEX / _SUN_LEVEL whatever the clock and the weather say.
  //   At d<1 — the mouth and the crevice, which are REAL openings — it is still a blend from the
  //   live surface values, so the threshold keeps tracking the daylight it can actually see.
  //   (Fog was already written this way: `+= (TARGET - fog) * d` reaches a constant at d=1.)
  if (d > 0) {
    const L = ctx.lights;
    L.ambient.intensity += (Tuning.CAVE_DARK_AMBIENT_LEVEL - L.ambient.intensity) * d;
    L.ambient.color.lerp(atmo._ambColor.setHex(Tuning.CAVE_DARK_AMBIENT_HEX), d);
    L.sun.intensity += (Tuning.CAVE_DARK_SUN_LEVEL - L.sun.intensity) * d;
    L.moon.intensity += (Tuning.CAVE_DARK_SUN_LEVEL - L.moon.intensity) * d;
  }

  // Fog: shift colour toward near-black + raise density with darkness. Lerp FROM this frame's live
  // fog (updateWeather already set the surface colour + density earlier in the tick), so at d=0 the
  // fog is left completely untouched — the surface storm fog is never clobbered.
  const fog = ctx.three.scene.fog as THREE.FogExp2 | null;
  if (fog && d > 0) {
    fog.density += (Tuning.CAVE_FOG_DENSITY - fog.density) * d;
    fog.color.lerp(atmo._fogColor.setHex(Tuning.CAVE_FOG_HEX), d);
  }

  // ── DEEPER cycle 7 — publish the cave-rock light response (the envelope gain + the carried-light
  //    bounce). ONE place, so "how bright is torch-lit rock" and "how much comes back off the floor"
  //    can never disagree between the game and the audit rig (which calls the SAME setter through
  //    `__game.setCaveRockLight`). NO FREE LIGHT: `carried` is read from the held lights, which
  //    updateViewModel zeroes every frame unless a LIT emitter is equipped — so with nothing out this
  //    resolves to intensity 0 and the shader's bounce block adds exactly vec3(0).
  //    One frame of latency (updateViewModel runs later in the tick than this) is deliberate and
  //    invisible on a fill term; it costs nothing and avoids a second tick-order constraint.
  const vm = ctx.player.viewModel;
  const pt = vm ? vm.heldPointLight : null;
  const sp = vm ? vm.heldSpotLight : null;
  const ptI = pt ? pt.intensity : 0;
  // A flashlight is a directed beam: most of its output lands in a cone somewhere ahead, so it
  // returns less diffuse bounce per candela than an omnidirectional flame does.
  const spI = sp ? sp.intensity * Tuning.CAVE_BOUNCE_SPOT_FRAC : 0;
  const src = ptI >= spI ? pt : sp;
  setCaveRockLightState(
    src ? src.position.x : p.x, src ? src.position.y : p.y, src ? src.position.z : p.z,
    ptI + spI, d,
  );

  // The mouth shaft — warm daylight down the ramp, bright at noon → faint at night. Only enabled
  // when the player is near the cave (within the AABB + margin), so it never touches the far surface.
  const m = Tuning.CAVE_DARK_AABB_MARGIN + 6;
  const near = p.x > atmo.minX - m && p.x < atmo.maxX + m && p.z > atmo.minZ - m && p.z < atmo.maxZ + m;
  const sunUp = Math.max(0, ctx.time.sunHeight);
  const shaftInt = near ? Tuning.CAVE_SHAFT_INTENSITY * (0.12 + 0.88 * sunUp) : 0;
  atmo.shaft.visible = shaftInt > 0.01;
  atmo.shaft.intensity = shaftInt;
}
